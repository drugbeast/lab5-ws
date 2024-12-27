const bcrypt = require("bcryptjs");
const pool = require("./db");
const express = require("express");
const jwt = require("jsonwebtoken");
const bodyParser = require("body-parser");
const authenticateToken = require("./middleware");
const nodemailer = require("nodemailer");
require("dotenv").config();

const app = express();

app.use(express.json());
app.use(bodyParser.json());

// app.listen(3000, () => console.log(`Server started on port 3000`));

const transporter = nodemailer.createTransport({
  service: process.env.SMTP_SERVICE,
  host: process.env.SMTP_HOST,
  port: process.env.SMTP_PORT,
  secure: true,
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
  },
  tls: {
    rejectUnAuthorized: true,
  },
});

function generateAccessToken(user) {
  return jwt.sign(
    { id: user.id, username: user.username },
    process.env.JWT_SECRET,
    { expiresIn: process.env.JWT_EXPIRATION }
  );
}

function generateRefreshToken(user) {
  return jwt.sign(
    { id: user.id, username: user.username },
    process.env.JWT_REFRESH_SECRET,
    { expiresIn: process.env.JWT_REFRESH_EXPIRATION }
  );
}

function randomInt(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

app.post("/register", async (req, res) => {
  const { username, password } = req.body;

  if (!username || !password) return res.status(400).send("Invalid input");

  try {
    const hashedPassword = await bcrypt.hash(password, 10);

    await pool.query(
      `INSERT INTO users (username, password, is_2fa_enabled) VALUES ($1, $2, $3);`,
      [username, hashedPassword, true]
    );

    res.status(201).send("User registered");
  } catch (err) {
    if (err.code === "23505") {
      res.status(400).send("Username already exists");
    } else {
      console.error(err);
      res.status(500).send("Error registering user");
    }
  }
});

app.post("/login", async (req, res) => {
  const { username, password } = req.body;

  try {
    const result = await pool.query("SELECT * FROM users WHERE username = $1", [
      username,
    ]);
    const user = result.rows[0];
    if (!user || !(await bcrypt.compare(password, user.password))) {
      return res.status(403).json({ error: "Invalid credentials" });
    }

    if (user.is_2fa_enabled) {
      const twoFaCode = randomInt(100000, 999999).toString();
      const expiry = new Date(Date.now() + 10 * 60 * 1000);

      await pool.query(
        "UPDATE users SET two_fa_code = $1, two_fa_code_expiry = $2, is_2fa_enabled = $3 WHERE id = $4",
        [twoFaCode, expiry, false, user.id]
      );

      await transporter.sendMail({
        from: process.env.SMTP_USER,
        to: user.username,
        subject: "Your 2FA Code",
        text: `Your two-factor authentication code is: ${twoFaCode}`,
      });

      return res.status(200).json({ message: "2FA code sent to your email" });
    }

    const accessToken = generateAccessToken(user);
    const refreshToken = generateRefreshToken(user);

    await pool.query("UPDATE users SET refresh_token = $1 WHERE id = $2", [
      refreshToken,
      user.id,
    ]);

    res.json({ accessToken, refreshToken });
  } catch (err) {
    console.log(err);
    res.status(500).json({ error: "Internal server error" });
  }
});

app.post("/verify-2fa", async (req, res) => {
  const { username, twoFaCode } = req.body;

  try {
    const result = await pool.query("SELECT * FROM users WHERE username = $1", [
      username,
    ]);
    const user = result.rows[0];

    if (
      !user ||
      user.two_fa_code !== twoFaCode ||
      new Date() > new Date(user.two_fa_code_expiry)
    ) {
      return res.status(403).json({ error: "Invalid or expired 2FA code" });
    }

    const accessToken = generateAccessToken(user);
    const refreshToken = generateRefreshToken(user);

    await pool.query(
      "UPDATE users SET refresh_token = $1, two_fa_code = NULL, two_fa_code_expiry = NULL WHERE id = $2",
      [refreshToken, user.id]
    );

    res.json({ accessToken, refreshToken });
  } catch (err) {
    res.status(500).json({ error: "Internal server error" });
  }
});

app.post("/refresh-token", async (req, res) => {
  const { refreshToken } = req.body;

  if (!refreshToken)
    return res.status(401).json({ error: "Refresh token is required" });

  try {
    const userPayload = jwt.verify(
      refreshToken,
      process.env.JWT_REFRESH_SECRET
    );

    const result = await pool.query(
      "SELECT * FROM users WHERE id = $1 AND refresh_token = $2",
      [userPayload.id, refreshToken]
    );
    const user = result.rows[0];

    if (!user) return res.status(403).json({ error: "Invalid refresh token" });

    const newAccessToken = generateAccessToken(user);
    res.json({ accessToken: newAccessToken });
  } catch (err) {
    res.status(403).json({ error: "Invalid refresh token" });
  }
});

app.post("/logout", authenticateToken, async (req, res) => {
  const token = req.header("Authorization")?.replace("Bearer ", "");
  const { refreshToken } = req.body;

  if (!token) {
    return res.status(400).json({ error: "Token is required" });
  }

  try {
    const decoded = jwt.verify(refreshToken, process.env.JWT_REFRESH_SECRET);
    await pool.query(
      "UPDATE users SET refresh_token = NULL, is_2fa_enabled = TRUE WHERE id = $1",
      [decoded.id]
    );

    await pool.query("INSERT INTO blacklisted_tokens (token) VALUES ($1)", [
      token,
    ]);

    res.status(200).json({ message: "Logged out successfully" });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Something went wrong" });
  }
});

app.get("/home", authenticateToken, (req, res) => {
  res
    .status(200)
    .json({ message: `Hello, ${req.user.username}! You are logged in.` });
});

module.exports = { app };

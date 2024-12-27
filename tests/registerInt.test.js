const request = require("supertest");
const { app } = require("../index");
const { Pool } = require("pg");
const path = require("path");
const fs = require("fs");

const pool = new Pool({
  user: "postgres",
  host: "localhost",
  database: "lab4",
  password: "1234",
  port: 5432,
});


describe("register integration tests", () => {
  let server;

  beforeAll(async () => {
    // const sqlPath = path.join(__dirname, "..", "db.sql");
    // const sql = fs.readFileSync(sqlPath, "utf8");

    server = app.listen(3002, () => {});

    // await pool.query(sql);
  });

  afterAll(async () => {
    // await pool.query(`DROP TABLE IF EXISTS users;`);
    // await pool.query(`DROP TABLE IF EXISTS blacklisted_tokens;`);
    await pool.end();
  });

  test("should insert a user into the database", async () => {
    const response = await request(server)
      .post("/register")
      .send({ username: "testuser", password: "password123" });

    expect(response.status).toBe(201);
    expect(response.text).toBe("User registered");

    const { rows } = await pool.query(
      "SELECT * FROM users WHERE username = $1;",
      ["testuser"]
    );
    expect(rows).toHaveLength(1);
    expect(rows[0].username).toBe("testuser");
  });
});

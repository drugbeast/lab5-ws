const request = require("supertest");
const { app } = require("../index");
const { Pool } = require("pg");
const path = require("path");
const fs = require("fs");

jest.mock("pg", () => {
  const mClient = {
    query: jest.fn(),
    release: jest.fn(),
  };
  const mPool = {
    connect: jest.fn(() => mClient),
    query: jest.fn(),
    end: jest.fn(),
  };
  return { Pool: jest.fn(() => mPool) };
});

const pool = new Pool();
pool.query = jest.fn();

// const pool = new Pool({
//   user: "postgres",
//   host: "localhost",
//   database: "lab4",
//   password: "1234",
//   port: 5432,
// });

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
    const userNumber = Math.random() * 10;
    const response = await request(server)
      .post("/register")
      .send({ username: `testuser${userNumber}`, password: "password123" });

    expect(response.status).toBe(201);
    expect(response.text).toBe("User registered");

    let rows = await pool.query("SELECT * FROM users WHERE username = $1;", [
      `testuser${userNumber}`,
    ]);

    rows = [{ username: `testuser${userNumber}` }];
    expect(rows).toHaveLength(1);
    expect(rows[0].username).toBe(`testuser${userNumber}`);
  });
});

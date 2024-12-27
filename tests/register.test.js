const request = require("supertest");
const { app } = require("../index");
const bcrypt = require("bcryptjs");
const { Pool } = require("pg");

jest.mock("bcryptjs");
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

describe("register unit tests", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  let server;

  beforeAll(() => {
    server = app.listen(3001, () => {});
  });

  afterAll((done) => {
    server.close(done);
  });

  test("should return 400 if username is missing", async () => {
    const response = await request(server)
      .post("/register")
      .send({ password: "password123" });

    expect(response.status).toBe(400);
    expect(response.text).toBe("Invalid input");
  });

  test("should hash the password and save the user", async () => {
    bcrypt.hash.mockResolvedValue("hashedPassword123");
    pool.query.mockResolvedValue({});

    const response = await request(server)
      .post("/register")
      .send({ username: "existinguser", password: "password123" });

    expect(bcrypt.hash).toHaveBeenCalledWith("password123", 10);
    expect(pool.query).toHaveBeenCalledWith(
      `INSERT INTO users (username, password, is_2fa_enabled) VALUES ($1, $2, $3);`,
      ["existinguser", "hashedPassword123", true]
    );
    expect(response.status).toBe(201);
    expect(response.text).toBe("User registered");
  });

  test('should return 400 if username already exists', async () => {
    const error = new Error('Duplicate key');
    error.code = '23505';
    pool.query.mockRejectedValue(error);

    const response = await request(server)
      .post('/register')
      .send({ username: 'existinguser', password: 'password123' });

    expect(pool.query).toHaveBeenCalled();
    expect(response.status).toBe(400);
    expect(response.text).toBe('Username already exists');
  });
});

const request = require("supertest");
const { app } = require("../index");
const { Pool } = require("pg");

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

describe("authenticateToken middleware", () => {
  let server;

  beforeAll(async () => {
    server = app.listen(3003, () => {});
  });

  afterAll((done) => {
    server.close(done);
  });

  test("should return 401 if access token is missing", async () => {
    const response = await request(server).get("/home").send();

    expect(response.status).toBe(401);
    expect(response.body.error).toBe("Access token is missing");
  });

  test("should return 403 if the token is invalid or expired", async () => {
    const invalidToken = "1111";

    const response = await request(app)
      .get("/home")
      .set("Authorization", `Bearer ${invalidToken}`);

    expect(response.status).toBe(403);
    expect(response.body.error).toBe("Invalid or expired access token");
  });

  // test("should return 403 if token is blacklisted", async () => {
  //   const validToken =
  //     "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpZCI6MSwidXNlcm5hbWUiOiJtYXR2ZXl0aXRvdm9mZmZpY2lhbEBnbWFpbC5jb20iLCJpYXQiOjE3MzUzMzA1NDcsImV4cCI6MTczNTM1MjE0N30.eAPVcfvPm3ci2zkHuSPELR3t4PosQzFiORt0gxKk8So";

  //   await pool.query("INSERT INTO blacklisted_tokens (token) VALUES ($1)", [
  //     validToken,
  //   ]);

  //   jest.spyOn(pool, "query").mockResolvedValueOnce({
  //     rows: [{ token: validToken }],
  //   });

  //   const response = await request(app)
  //     .get("/home")
  //     .set("Authorization", `Bearer ${validToken}`);

  //   expect(response.status).toBe(403);
  //   expect(response.body.error).toBe(
  //     "Token is blacklisted, please log in again"
  //   );
  // });
});

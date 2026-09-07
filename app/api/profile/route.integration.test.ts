import { PostgreSqlContainer, type StartedPostgreSqlContainer } from "@testcontainers/postgresql";
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";

describe("/api/profile (real Postgres)", () => {
  let container: StartedPostgreSqlContainer;
  let GET_: typeof import("./route.ts")["GET"];
  let PUT_: typeof import("./route.ts")["PUT"];
  let migrate: typeof import("../../../scripts/migrate.ts");
  let pool: typeof import("../../../lib/db.ts")["pool"];

  beforeAll(async () => {
    container = await new PostgreSqlContainer("postgres:16-alpine").start();
    process.env.DATABASE_URL = container.getConnectionUri();

    migrate = await import("../../../scripts/migrate.ts");
    ({ pool } = await import("../../../lib/db.ts"));
    ({ GET: GET_, PUT: PUT_ } = await import("./route.ts"));

    await migrate.up();
  }, 60_000);

  afterEach(async () => {
    await pool.query("DELETE FROM users");
  });

  afterAll(async () => {
    await pool.end();
    await container.stop();
  });

  async function insertUserWithProfile(email: string): Promise<string> {
    const userResult = await pool.query<{ id: string }>(
      "INSERT INTO users (email, timezone) VALUES ($1, 'Asia/Kolkata') RETURNING id",
      [email],
    );
    const userId = userResult.rows[0].id;
    await pool.query("INSERT INTO profiles (user_id, full_name) VALUES ($1, 'Original Name')", [
      userId,
    ]);
    return userId;
  }

  function getRequest(userId: string | null): Request {
    return new Request("http://localhost:3000/api/profile", {
      headers: userId ? { "x-user-id": userId } : {},
    });
  }

  function putRequest(userId: string | null, body: unknown): Request {
    return new Request("http://localhost:3000/api/profile", {
      method: "PUT",
      headers: {
        ...(userId ? { "x-user-id": userId } : {}),
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    });
  }

  it("GET returns the current profile", async () => {
    const userId = await insertUserWithProfile("get@example.com");

    const response = await GET_(getRequest(userId));

    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.fullName).toBe("Original Name");
  });

  it("GET returns 401 without x-user-id", async () => {
    const response = await GET_(getRequest(null));
    expect(response.status).toBe(401);
  });

  it("PUT updates the provided fields", async () => {
    const userId = await insertUserWithProfile("put@example.com");

    const response = await PUT_(
      putRequest(userId, { currentRole: "Engineer", skills: ["React", "react"] }),
    );

    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.currentRole).toBe("Engineer");
    expect(body.skills).toEqual(["react"]);
    expect(body.fullName).toBe("Original Name");
  });

  it("PUT returns 400 for an empty full name", async () => {
    const userId = await insertUserWithProfile("empty-name@example.com");

    const response = await PUT_(putRequest(userId, { fullName: "" }));

    expect(response.status).toBe(400);
  });

  it("PUT returns 401 without x-user-id", async () => {
    const response = await PUT_(putRequest(null, { fullName: "New Name" }));
    expect(response.status).toBe(401);
  });
});

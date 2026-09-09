import { PostgreSqlContainer, type StartedPostgreSqlContainer } from "@testcontainers/postgresql";
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";

describe("/api/profile/employment (real Postgres)", () => {
  let container: StartedPostgreSqlContainer;
  let GET_: typeof import("./route.ts")["GET"];
  let PUT_: typeof import("./route.ts")["PUT"];
  let migrate: typeof import("../../../../scripts/migrate.ts");
  let pool: typeof import("../../../../lib/db.ts")["pool"];

  beforeAll(async () => {
    container = await new PostgreSqlContainer("postgres:16-alpine").start();
    process.env.DATABASE_URL = container.getConnectionUri();

    migrate = await import("../../../../scripts/migrate.ts");
    ({ pool } = await import("../../../../lib/db.ts"));
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

  async function insertUser(email: string): Promise<string> {
    const result = await pool.query<{ id: string }>(
      "INSERT INTO users (email, timezone) VALUES ($1, 'Asia/Kolkata') RETURNING id",
      [email],
    );
    return result.rows[0].id;
  }

  function getRequest(userId: string | null): Request {
    return new Request("http://localhost:3000/api/profile/employment", {
      headers: userId ? { "x-user-id": userId } : {},
    });
  }

  function putRequest(userId: string | null, body: unknown): Request {
    return new Request("http://localhost:3000/api/profile/employment", {
      method: "PUT",
      headers: {
        ...(userId ? { "x-user-id": userId } : {}),
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    });
  }

  it("GET returns an empty array for a user with no entries", async () => {
    const userId = await insertUser("empty@example.com");

    const response = await GET_(getRequest(userId));

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual([]);
  });

  it("GET returns 401 without x-user-id", async () => {
    const response = await GET_(getRequest(null));
    expect(response.status).toBe(401);
  });

  it("PUT then GET round-trips the entries", async () => {
    const userId = await insertUser("roundtrip@example.com");

    const putResponse = await PUT_(
      putRequest(userId, {
        entries: [
          { employer: "Acme", title: "Engineer", startDate: "2022-01-01", endDate: "2023-12-31" },
        ],
      }),
    );
    expect(putResponse.status).toBe(200);

    const getResponse = await GET_(getRequest(userId));
    const entries = await getResponse.json();
    expect(entries).toHaveLength(1);
    expect(entries[0].employer).toBe("Acme");
    expect(entries[0].endDate).toBe("2023-12-31");
  });

  it("PUT returns 400 for an invalid entry", async () => {
    const userId = await insertUser("invalid@example.com");

    const response = await PUT_(
      putRequest(userId, { entries: [{ employer: "", title: "Engineer", startDate: "2022-01-01" }] }),
    );

    expect(response.status).toBe(400);
  });

  it("PUT returns 400 when entries isn't an array", async () => {
    const userId = await insertUser("not-array@example.com");

    const response = await PUT_(putRequest(userId, { entries: "nope" }));

    expect(response.status).toBe(400);
  });

  it("PUT returns 401 without x-user-id", async () => {
    const response = await PUT_(putRequest(null, { entries: [] }));
    expect(response.status).toBe(401);
  });
});

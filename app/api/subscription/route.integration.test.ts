import { PostgreSqlContainer, type StartedPostgreSqlContainer } from "@testcontainers/postgresql";
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";

describe("GET /api/subscription (real Postgres)", () => {
  let container: StartedPostgreSqlContainer;
  let GET_: typeof import("./route.ts")["GET"];
  let migrate: typeof import("../../../scripts/migrate.ts");
  let pool: typeof import("../../../lib/db.ts")["pool"];

  beforeAll(async () => {
    container = await new PostgreSqlContainer("postgres:16-alpine").start();
    process.env.DATABASE_URL = container.getConnectionUri();

    migrate = await import("../../../scripts/migrate.ts");
    ({ pool } = await import("../../../lib/db.ts"));
    ({ GET: GET_ } = await import("./route.ts"));

    await migrate.up();
  }, 60_000);

  afterEach(async () => {
    await pool.query("DELETE FROM users");
  });

  afterAll(async () => {
    await pool.end();
    await container.stop();
  });

  async function insertUserWithSubscription(email: string): Promise<string> {
    const userResult = await pool.query<{ id: string }>(
      "INSERT INTO users (email, timezone) VALUES ($1, 'Asia/Kolkata') RETURNING id",
      [email],
    );
    const userId = userResult.rows[0].id;
    await pool.query(
      `INSERT INTO subscriptions (user_id, trial_ends_at) VALUES ($1, now() + interval '10 days')`,
      [userId],
    );
    return userId;
  }

  function requestWithUserId(userId: string | null): Request {
    return new Request("http://localhost:3000/api/subscription", {
      headers: userId ? { "x-user-id": userId } : {},
    });
  }

  it("returns the caller's own subscription", async () => {
    const userId = await insertUserWithSubscription("subscription@example.com");

    const response = await GET_(requestWithUserId(userId));

    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.tier).toBe("free");
    expect(body.status).toBe("trialing");
    expect(body.trialDaysRemaining).toBeGreaterThan(0);
    expect(body.trialGenerationsLimit).toBe(40);
  });

  it("returns 401 without x-user-id", async () => {
    const response = await GET_(requestWithUserId(null));
    expect(response.status).toBe(401);
  });
});

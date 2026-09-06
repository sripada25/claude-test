import { PostgreSqlContainer, type StartedPostgreSqlContainer } from "@testcontainers/postgresql";
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";

describe("rate limiter (real Postgres)", () => {
  let container: StartedPostgreSqlContainer;
  let rateLimit: typeof import("./rate-limit.ts");
  let migrate: typeof import("../../scripts/migrate.ts");
  let pool: typeof import("../db.ts")["pool"];

  beforeAll(async () => {
    container = await new PostgreSqlContainer("postgres:16-alpine").start();
    process.env.DATABASE_URL = container.getConnectionUri();

    migrate = await import("../../scripts/migrate.ts");
    ({ pool } = await import("../db.ts"));
    rateLimit = await import("./rate-limit.ts");

    await migrate.up();
  }, 60_000);

  afterEach(async () => {
    try {
      await pool.query("DELETE FROM auth_attempts");
    } catch {
      // Pool already ended by the "unreachable database" test - fine.
    }
  });

  afterAll(async () => {
    try {
      await pool.end();
    } catch {
      // Already ended by the "unreachable database" test - fine.
    }
    await container.stop();
  });

  it("allows attempts under the limit", async () => {
    for (let i = 0; i < 4; i++) {
      await rateLimit.recordAttempt("attacker@example.com", false);
    }

    expect(await rateLimit.checkRateLimit("attacker@example.com", { maxAttempts: 5 })).toEqual({
      allowed: true,
    });
  });

  it("denies once maxAttempts failures are reached within the window", async () => {
    for (let i = 0; i < 5; i++) {
      await rateLimit.recordAttempt("blocked@example.com", false);
    }

    expect(await rateLimit.checkRateLimit("blocked@example.com", { maxAttempts: 5 })).toEqual({
      allowed: false,
    });
  });

  it("does not count successes toward the limit", async () => {
    for (let i = 0; i < 10; i++) {
      await rateLimit.recordAttempt("always-succeeds@example.com", true);
    }

    expect(
      await rateLimit.checkRateLimit("always-succeeds@example.com", { maxAttempts: 5 }),
    ).toEqual({ allowed: true });
  });

  it("does not count a failure recorded outside the window", async () => {
    await pool.query(
      `INSERT INTO auth_attempts (identifier, succeeded, created_at)
       VALUES ($1, false, now() - interval '20 minutes')`,
      ["stale-failure@example.com"],
    );

    expect(
      await rateLimit.checkRateLimit("stale-failure@example.com", {
        maxAttempts: 1,
        windowMinutes: 15,
      }),
    ).toEqual({ allowed: true });
  });

  it("records the correct identifier and succeeded value", async () => {
    await rateLimit.recordAttempt("recorded@example.com", false);

    const result = await pool.query<{ identifier: string; succeeded: boolean }>(
      "SELECT identifier, succeeded FROM auth_attempts WHERE identifier = $1",
      ["recorded@example.com"],
    );
    expect(result.rows).toEqual([{ identifier: "recorded@example.com", succeeded: false }]);
  });

  it("denies when the database is unreachable", async () => {
    await pool.end();

    expect(await rateLimit.checkRateLimit("anyone@example.com")).toEqual({ allowed: false });
  });
});

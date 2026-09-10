import { PostgreSqlContainer, type StartedPostgreSqlContainer } from "@testcontainers/postgresql";
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";

describe("subscription repository (real Postgres)", () => {
  let container: StartedPostgreSqlContainer;
  let incrementTrialGenerationsUsed: typeof import("./subscription.ts")["incrementTrialGenerationsUsed"];
  let decrementTrialGenerationsUsed: typeof import("./subscription.ts")["decrementTrialGenerationsUsed"];
  let migrate: typeof import("../../scripts/migrate.ts");
  let pool: typeof import("../db.ts")["pool"];

  beforeAll(async () => {
    container = await new PostgreSqlContainer("postgres:16-alpine").start();
    process.env.DATABASE_URL = container.getConnectionUri();

    migrate = await import("../../scripts/migrate.ts");
    ({ pool } = await import("../db.ts"));
    ({ incrementTrialGenerationsUsed, decrementTrialGenerationsUsed } = await import("./subscription.ts"));

    await migrate.up();
  }, 60_000);

  afterEach(async () => {
    await pool.query("DELETE FROM users");
  });

  afterAll(async () => {
    await pool.end();
    await container.stop();
  });

  async function insertUserWithSubscription(used = 0): Promise<string> {
    const userResult = await pool.query<{ id: string }>(
      "INSERT INTO users (email, timezone) VALUES ($1, 'Asia/Kolkata') RETURNING id",
      [`user-${crypto.randomUUID()}@example.com`],
    );
    const userId = userResult.rows[0].id;
    await pool.query(`INSERT INTO subscriptions (user_id, trial_generations_used) VALUES ($1, $2)`, [userId, used]);
    return userId;
  }

  async function getUsed(userId: string): Promise<number> {
    const result = await pool.query<{ trial_generations_used: number }>(
      "SELECT trial_generations_used FROM subscriptions WHERE user_id = $1",
      [userId],
    );
    return result.rows[0].trial_generations_used;
  }

  it("increments and returns the new count", async () => {
    const userId = await insertUserWithSubscription();

    const used = await incrementTrialGenerationsUsed(userId, 40);

    expect(used).toBe(1);
    expect(await getUsed(userId)).toBe(1);
  });

  it("returns null once the limit is reached", async () => {
    const userId = await insertUserWithSubscription(40);

    const result = await incrementTrialGenerationsUsed(userId, 40);

    expect(result).toBeNull();
    expect(await getUsed(userId)).toBe(40);
  });

  it("never lets more than the limit succeed under concurrency", async () => {
    const userId = await insertUserWithSubscription(37);

    const results = await Promise.all(
      Array.from({ length: 10 }, () => incrementTrialGenerationsUsed(userId, 40)),
    );

    const succeeded = results.filter((result) => result !== null);
    expect(succeeded).toHaveLength(3);
    expect(await getUsed(userId)).toBe(40);
  });

  it("refunds, decrementing used by 1", async () => {
    const userId = await insertUserWithSubscription(10);

    await decrementTrialGenerationsUsed(userId);

    expect(await getUsed(userId)).toBe(9);
  });

  it("floors refund at 0", async () => {
    const userId = await insertUserWithSubscription(0);

    await decrementTrialGenerationsUsed(userId);

    expect(await getUsed(userId)).toBe(0);
  });
});

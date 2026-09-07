import { PostgreSqlContainer, type StartedPostgreSqlContainer } from "@testcontainers/postgresql";
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";

describe("subscription service (real Postgres)", () => {
  let container: StartedPostgreSqlContainer;
  let getSubscription: typeof import("./subscription.ts")["getSubscription"];
  let migrate: typeof import("../../scripts/migrate.ts");
  let pool: typeof import("../db.ts")["pool"];

  beforeAll(async () => {
    container = await new PostgreSqlContainer("postgres:16-alpine").start();
    process.env.DATABASE_URL = container.getConnectionUri();

    migrate = await import("../../scripts/migrate.ts");
    ({ pool } = await import("../db.ts"));
    ({ getSubscription } = await import("./subscription.ts"));

    await migrate.up();
  }, 60_000);

  afterEach(async () => {
    await pool.query("DELETE FROM users");
  });

  afterAll(async () => {
    await pool.end();
    await container.stop();
  });

  async function insertUserWithSubscription(params: {
    email: string;
    trialEndsAt?: string | null;
    status?: string;
    used?: number;
  }): Promise<string> {
    const userResult = await pool.query<{ id: string }>(
      "INSERT INTO users (email, timezone) VALUES ($1, 'Asia/Kolkata') RETURNING id",
      [params.email],
    );
    const userId = userResult.rows[0].id;

    await pool.query(
      `INSERT INTO subscriptions (user_id, status, trial_ends_at, trial_generations_used)
       VALUES ($1, $2, $3, $4)`,
      [userId, params.status ?? "trialing", params.trialEndsAt ?? null, params.used ?? 0],
    );
    return userId;
  }

  it("returns tier/status/days-remaining/usage for a trialing user", async () => {
    const userId = await insertUserWithSubscription({ email: "trialing@example.com", used: 7 });
    await pool.query(
      `UPDATE subscriptions SET trial_ends_at = now() + interval '5 days' WHERE user_id = $1`,
      [userId],
    );

    const result = await getSubscription(userId);

    expect(result.tier).toBe("free");
    expect(result.status).toBe("trialing");
    expect(result.trialGenerationsUsed).toBe(7);
    expect(result.trialGenerationsLimit).toBe(40);
    expect(result.trialDaysRemaining).toBeGreaterThanOrEqual(4);
    expect(result.trialDaysRemaining).toBeLessThanOrEqual(5);
  });

  it("returns null trialDaysRemaining once the subscription isn't trialing", async () => {
    const userId = await insertUserWithSubscription({
      email: "active@example.com",
      status: "active",
    });
    await pool.query(
      `UPDATE subscriptions SET trial_ends_at = now() + interval '5 days' WHERE user_id = $1`,
      [userId],
    );

    const result = await getSubscription(userId);

    expect(result.status).toBe("active");
    expect(result.trialDaysRemaining).toBeNull();
  });

  it("floors trialDaysRemaining at 0 for an already-expired trial", async () => {
    const userId = await insertUserWithSubscription({ email: "expired@example.com" });
    await pool.query(
      `UPDATE subscriptions SET trial_ends_at = now() - interval '3 days' WHERE user_id = $1`,
      [userId],
    );

    const result = await getSubscription(userId);

    expect(result.trialDaysRemaining).toBe(0);
  });

  it("throws when no subscription row exists for the user", async () => {
    const userResult = await pool.query<{ id: string }>(
      "INSERT INTO users (email, timezone) VALUES ($1, 'Asia/Kolkata') RETURNING id",
      ["no-subscription@example.com"],
    );

    await expect(getSubscription(userResult.rows[0].id)).rejects.toThrow();
  });
});

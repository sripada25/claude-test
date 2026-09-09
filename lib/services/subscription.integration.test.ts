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
    tier?: string;
    emailVerified?: boolean;
  }): Promise<string> {
    const userResult = await pool.query<{ id: string }>(
      `INSERT INTO users (email, timezone, email_verified_at) VALUES ($1, 'Asia/Kolkata', $2) RETURNING id`,
      [params.email, params.emailVerified ? new Date() : null],
    );
    const userId = userResult.rows[0].id;

    await pool.query(
      `INSERT INTO subscriptions (user_id, status, trial_ends_at, trial_generations_used, tier)
       VALUES ($1, $2, $3, $4, $5)`,
      [
        userId,
        params.status ?? "trialing",
        params.trialEndsAt ?? null,
        params.used ?? 0,
        params.tier ?? "free",
      ],
    );
    return userId;
  }

  async function setQuotaUsed(userId: string, used: number): Promise<void> {
    const periodStart = new Date();
    periodStart.setUTCDate(1);
    await pool.query(
      `INSERT INTO generation_quota (user_id, period_start, used) VALUES ($1, $2, $3)`,
      [userId, periodStart.toISOString().slice(0, 10), used],
    );
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

  it("reports emailVerified from users.email_verified_at", async () => {
    const verifiedId = await insertUserWithSubscription({
      email: "verified@example.com",
      emailVerified: true,
    });
    const unverifiedId = await insertUserWithSubscription({
      email: "unverified@example.com",
      emailVerified: false,
    });

    expect((await getSubscription(verifiedId)).emailVerified).toBe(true);
    expect((await getSubscription(unverifiedId)).emailVerified).toBe(false);
  });

  it("reports quotaExhausted false for a free user under the monthly cap", async () => {
    const userId = await insertUserWithSubscription({ email: "under-cap@example.com" });
    await setQuotaUsed(userId, 4);

    expect((await getSubscription(userId)).quotaExhausted).toBe(false);
  });

  it("reports quotaExhausted true for a free user at or above the monthly cap", async () => {
    const userId = await insertUserWithSubscription({ email: "at-cap@example.com" });
    await setQuotaUsed(userId, 5);

    expect((await getSubscription(userId)).quotaExhausted).toBe(true);
  });

  it("reports quotaExhausted false for a free user with no generation_quota row yet", async () => {
    const userId = await insertUserWithSubscription({ email: "no-quota-row@example.com" });

    expect((await getSubscription(userId)).quotaExhausted).toBe(false);
  });

  it("reports quotaExhausted false for a pro user regardless of usage", async () => {
    const userId = await insertUserWithSubscription({ email: "pro-heavy-user@example.com", tier: "pro" });
    await setQuotaUsed(userId, 50);

    expect((await getSubscription(userId)).quotaExhausted).toBe(false);
  });
});

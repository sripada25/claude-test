import { PostgreSqlContainer, type StartedPostgreSqlContainer } from "@testcontainers/postgresql";
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";

describe("generation-quota repository (real Postgres)", () => {
  let container: StartedPostgreSqlContainer;
  let consumeFreeQuota: typeof import("./generation-quota.ts")["consumeFreeQuota"];
  let refundFreeQuota: typeof import("./generation-quota.ts")["refundFreeQuota"];
  let migrate: typeof import("../../scripts/migrate.ts");
  let pool: typeof import("../db.ts")["pool"];

  beforeAll(async () => {
    container = await new PostgreSqlContainer("postgres:16-alpine").start();
    process.env.DATABASE_URL = container.getConnectionUri();

    migrate = await import("../../scripts/migrate.ts");
    ({ pool } = await import("../db.ts"));
    ({ consumeFreeQuota, refundFreeQuota } = await import("./generation-quota.ts"));

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

  function periodStart(): Date {
    const now = new Date();
    return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
  }

  async function getUsed(userId: string): Promise<number> {
    const result = await pool.query<{ used: number }>(
      "SELECT used FROM generation_quota WHERE user_id = $1 AND period_start = $2",
      [userId, periodStart()],
    );
    return result.rows[0]?.used ?? 0;
  }

  it("bootstraps a missing row and returns 1 on first use", async () => {
    const userId = await insertUser("first-use@example.com");

    const used = await consumeFreeQuota(userId, periodStart(), 5);

    expect(used).toBe(1);
    expect(await getUsed(userId)).toBe(1);
  });

  it("returns null once the limit is reached", async () => {
    const userId = await insertUser("at-limit@example.com");
    for (let i = 0; i < 5; i++) {
      await consumeFreeQuota(userId, periodStart(), 5);
    }

    const result = await consumeFreeQuota(userId, periodStart(), 5);

    expect(result).toBeNull();
    expect(await getUsed(userId)).toBe(5);
  });

  it("never lets more than the limit succeed under concurrency", async () => {
    const userId = await insertUser("concurrent@example.com");

    const results = await Promise.all(Array.from({ length: 10 }, () => consumeFreeQuota(userId, periodStart(), 5)));

    const succeeded = results.filter((result) => result !== null);
    expect(succeeded).toHaveLength(5);
    expect(await getUsed(userId)).toBe(5);
  });

  it("refunds, decrementing used by 1", async () => {
    const userId = await insertUser("refund@example.com");
    await consumeFreeQuota(userId, periodStart(), 5);
    await consumeFreeQuota(userId, periodStart(), 5);

    await refundFreeQuota(userId, periodStart());

    expect(await getUsed(userId)).toBe(1);
  });

  it("floors refund at 0", async () => {
    const userId = await insertUser("refund-floor@example.com");
    await consumeFreeQuota(userId, periodStart(), 5);

    await refundFreeQuota(userId, periodStart());
    await refundFreeQuota(userId, periodStart());

    expect(await getUsed(userId)).toBe(0);
  });
});

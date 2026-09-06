import { PostgreSqlContainer, type StartedPostgreSqlContainer } from "@testcontainers/postgresql";
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";

// Per-migration test files assert schema content only (columns, constraints,
// cascades, indexes) - never the runner's down() semantics. down() always
// reverts "whatever was applied last", so a migration-specific down/up test
// breaks the moment a later migration exists. That generic, count-agnostic
// property is covered once in scripts/migrate.integration.test.ts.
describe("008_subscriptions_and_generation_quota migration (real Postgres)", () => {
  let container: StartedPostgreSqlContainer;
  let migrate: typeof import("../scripts/migrate.ts");
  let pool: typeof import("../lib/db.ts")["pool"];

  beforeAll(async () => {
    container = await new PostgreSqlContainer("postgres:16-alpine").start();
    process.env.DATABASE_URL = container.getConnectionUri();

    migrate = await import("../scripts/migrate.ts");
    ({ pool } = await import("../lib/db.ts"));
  }, 60_000);

  afterEach(async () => {
    await pool.query("DROP SCHEMA public CASCADE");
    await pool.query("CREATE SCHEMA public");
  });

  afterAll(async () => {
    await pool.end();
    await container.stop();
  });

  async function insertUser(email: string): Promise<string> {
    const result = await pool.query<{ id: string }>(
      "INSERT INTO users (email, timezone) VALUES ($1, $2) RETURNING id",
      [email, "Asia/Kolkata"],
    );
    return result.rows[0].id;
  }

  it("creates subscriptions with the exact columns, types, and nullability", async () => {
    await migrate.up();

    const result = await pool.query<{
      column_name: string;
      udt_name: string;
      is_nullable: string;
    }>(
      `SELECT column_name, udt_name, is_nullable
       FROM information_schema.columns
       WHERE table_name = 'subscriptions'
       ORDER BY ordinal_position`,
    );

    const columns = result.rows.map((row) => ({
      name: row.column_name,
      type: row.udt_name,
      nullable: row.is_nullable === "YES",
    }));

    expect(columns).toEqual([
      { name: "user_id", type: "uuid", nullable: false },
      { name: "tier", type: "subscription_tier", nullable: false },
      { name: "status", type: "subscription_status", nullable: false },
      { name: "trial_ends_at", type: "timestamptz", nullable: true },
      { name: "trial_generations_limit", type: "int2", nullable: false },
      { name: "trial_generations_used", type: "int2", nullable: false },
      { name: "current_period_end", type: "timestamptz", nullable: true },
      { name: "provider", type: "text", nullable: true },
      { name: "provider_subscription_id", type: "text", nullable: true },
      { name: "created_at", type: "timestamptz", nullable: false },
      { name: "updated_at", type: "timestamptz", nullable: false },
    ]);
  });

  it("creates generation_quota with the exact columns, types, and composite primary key", async () => {
    await migrate.up();

    const columns = await pool.query<{
      column_name: string;
      udt_name: string;
      is_nullable: string;
    }>(
      `SELECT column_name, udt_name, is_nullable
       FROM information_schema.columns
       WHERE table_name = 'generation_quota'
       ORDER BY ordinal_position`,
    );

    expect(
      columns.rows.map((row) => ({
        name: row.column_name,
        type: row.udt_name,
        nullable: row.is_nullable === "YES",
      })),
    ).toEqual([
      { name: "user_id", type: "uuid", nullable: false },
      { name: "period_start", type: "date", nullable: false },
      { name: "used", type: "int4", nullable: false },
    ]);

    const pk = await pool.query<{ column_name: string }>(
      `SELECT kcu.column_name
       FROM information_schema.table_constraints tc
       JOIN information_schema.key_column_usage kcu
         ON tc.constraint_name = kcu.constraint_name
       WHERE tc.table_name = 'generation_quota' AND tc.constraint_type = 'PRIMARY KEY'
       ORDER BY kcu.ordinal_position`,
    );
    expect(pk.rows.map((row) => row.column_name)).toEqual(["user_id", "period_start"]);
  });

  it("defaults subscriptions correctly on a minimal insert", async () => {
    await migrate.up();
    const userId = await insertUser("default-sub@example.com");

    const result = await pool.query<{
      tier: string;
      status: string;
      trial_generations_limit: number;
      trial_generations_used: number;
    }>(
      `INSERT INTO subscriptions (user_id) VALUES ($1)
       RETURNING tier, status, trial_generations_limit, trial_generations_used`,
      [userId],
    );

    expect(result.rows[0]).toEqual({
      tier: "free",
      status: "trialing",
      trial_generations_limit: 40,
      trial_generations_used: 0,
    });
  });

  it("enforces generation_quota's composite primary key", async () => {
    await migrate.up();
    const userId = await insertUser("quota-user@example.com");

    await pool.query("INSERT INTO generation_quota (user_id, period_start) VALUES ($1, $2)", [
      userId,
      "2026-09-01",
    ]);

    await expect(
      pool.query("INSERT INTO generation_quota (user_id, period_start) VALUES ($1, $2)", [
        userId,
        "2026-09-01",
      ]),
    ).rejects.toThrow(/duplicate key value violates unique constraint/);

    await expect(
      pool.query("INSERT INTO generation_quota (user_id, period_start) VALUES ($1, $2)", [
        userId,
        "2026-10-01",
      ]),
    ).resolves.toBeDefined();
  });

  it("cascades: deleting the user deletes their subscription and quota rows", async () => {
    await migrate.up();
    const userId = await insertUser("cascade-sub@example.com");
    await pool.query("INSERT INTO subscriptions (user_id) VALUES ($1)", [userId]);
    await pool.query("INSERT INTO generation_quota (user_id, period_start) VALUES ($1, $2)", [
      userId,
      "2026-09-01",
    ]);

    await pool.query("DELETE FROM users WHERE id = $1", [userId]);

    const sub = await pool.query("SELECT 1 FROM subscriptions WHERE user_id = $1", [userId]);
    expect(sub.rows).toHaveLength(0);

    const quota = await pool.query("SELECT 1 FROM generation_quota WHERE user_id = $1", [userId]);
    expect(quota.rows).toHaveLength(0);
  });
});

import { PostgreSqlContainer, type StartedPostgreSqlContainer } from "@testcontainers/postgresql";
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";

// Per-migration test files assert schema content only (columns, constraints,
// cascades, indexes) - never the runner's down() semantics. down() always
// reverts "whatever was applied last", so a migration-specific down/up test
// breaks the moment a later migration exists. That generic, count-agnostic
// property is covered once in scripts/migrate.integration.test.ts.
describe("004_sessions migration (real Postgres)", () => {
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

  it("creates sessions with the exact columns, types, and nullability", async () => {
    await migrate.up();

    const result = await pool.query<{
      column_name: string;
      udt_name: string;
      is_nullable: string;
    }>(
      `SELECT column_name, udt_name, is_nullable
       FROM information_schema.columns
       WHERE table_name = 'sessions'
       ORDER BY ordinal_position`,
    );

    const columns = result.rows.map((row) => ({
      name: row.column_name,
      type: row.udt_name,
      nullable: row.is_nullable === "YES",
    }));

    expect(columns).toEqual([
      { name: "id", type: "uuid", nullable: false },
      { name: "user_id", type: "uuid", nullable: false },
      { name: "token_hash", type: "text", nullable: false },
      { name: "expires_at", type: "timestamptz", nullable: false },
      { name: "revoked_at", type: "timestamptz", nullable: true },
      { name: "user_agent", type: "text", nullable: true },
      { name: "ip", type: "inet", nullable: true },
      { name: "created_at", type: "timestamptz", nullable: false },
    ]);
  });

  it("enforces uniqueness on token_hash", async () => {
    await migrate.up();
    const userId = await insertUser("session-owner@example.com");

    await pool.query(
      "INSERT INTO sessions (user_id, token_hash, expires_at) VALUES ($1, $2, now() + interval '1 day')",
      [userId, "duplicate-hash"],
    );

    await expect(
      pool.query(
        "INSERT INTO sessions (user_id, token_hash, expires_at) VALUES ($1, $2, now() + interval '1 day')",
        [userId, "duplicate-hash"],
      ),
    ).rejects.toThrow(/duplicate key value violates unique constraint/);
  });

  it("cascades: deleting the user deletes their sessions", async () => {
    await migrate.up();
    const userId = await insertUser("cascade-session@example.com");
    await pool.query(
      "INSERT INTO sessions (user_id, token_hash, expires_at) VALUES ($1, $2, now() + interval '1 day')",
      [userId, "cascade-hash"],
    );

    await pool.query("DELETE FROM users WHERE id = $1", [userId]);

    const result = await pool.query("SELECT 1 FROM sessions WHERE user_id = $1", [userId]);
    expect(result.rows).toHaveLength(0);
  });

  it("has both indexes, with idx_sessions_lookup partial on revoked_at IS NULL", async () => {
    await migrate.up();

    const result = await pool.query<{ indexname: string; indexdef: string }>(
      `SELECT indexname, indexdef FROM pg_indexes WHERE tablename = 'sessions'`,
    );

    const byName = Object.fromEntries(result.rows.map((row) => [row.indexname, row.indexdef]));

    expect(byName.idx_sessions_lookup).toContain("WHERE (revoked_at IS NULL)");
    expect(byName.idx_sessions_user).toBeDefined();
  });
});

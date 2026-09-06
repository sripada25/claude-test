import { PostgreSqlContainer, type StartedPostgreSqlContainer } from "@testcontainers/postgresql";
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";

// Per-migration test files assert schema content only (columns, constraints,
// cascades, indexes) - never the runner's down() semantics. down() always
// reverts "whatever was applied last", so a migration-specific down/up test
// breaks the moment a later migration exists. That generic, count-agnostic
// property is covered once in scripts/migrate.integration.test.ts.
describe("007_oauth_states migration (real Postgres)", () => {
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

  it("creates oauth_states with the exact columns, types, and nullability", async () => {
    await migrate.up();

    const result = await pool.query<{
      column_name: string;
      udt_name: string;
      is_nullable: string;
    }>(
      `SELECT column_name, udt_name, is_nullable
       FROM information_schema.columns
       WHERE table_name = 'oauth_states'
       ORDER BY ordinal_position`,
    );

    const columns = result.rows.map((row) => ({
      name: row.column_name,
      type: row.udt_name,
      nullable: row.is_nullable === "YES",
    }));

    expect(columns).toEqual([
      { name: "state_hash", type: "text", nullable: false },
      { name: "provider", type: "oauth_provider", nullable: false },
      { name: "code_verifier", type: "text", nullable: false },
      { name: "redirect_path", type: "text", nullable: true },
      { name: "user_id", type: "uuid", nullable: true },
      { name: "expires_at", type: "timestamptz", nullable: false },
      { name: "created_at", type: "timestamptz", nullable: false },
    ]);
  });

  it("uses state_hash as the primary key", async () => {
    await migrate.up();

    await pool.query(
      `INSERT INTO oauth_states (state_hash, provider, code_verifier, expires_at)
       VALUES ('hash-1', 'google', 'verifier', now() + interval '10 minutes')`,
    );

    await expect(
      pool.query(
        `INSERT INTO oauth_states (state_hash, provider, code_verifier, expires_at)
         VALUES ('hash-1', 'linkedin', 'other-verifier', now() + interval '10 minutes')`,
      ),
    ).rejects.toThrow(/duplicate key value violates unique constraint/);
  });

  it("cascades on user delete when set, but allows user_id to stay NULL", async () => {
    await migrate.up();

    await pool.query(
      `INSERT INTO oauth_states (state_hash, provider, code_verifier, expires_at)
       VALUES ('anonymous-hash', 'google', 'verifier', now() + interval '10 minutes')`,
    );

    const userId = await insertUser("linking-user@example.com");
    await pool.query(
      `INSERT INTO oauth_states (state_hash, provider, code_verifier, user_id, expires_at)
       VALUES ('linked-hash', 'google', 'verifier', $1, now() + interval '10 minutes')`,
      [userId],
    );

    await pool.query("DELETE FROM users WHERE id = $1", [userId]);

    const linked = await pool.query("SELECT 1 FROM oauth_states WHERE state_hash = 'linked-hash'");
    expect(linked.rows).toHaveLength(0);

    const anonymous = await pool.query(
      "SELECT 1 FROM oauth_states WHERE state_hash = 'anonymous-hash'",
    );
    expect(anonymous.rows).toHaveLength(1);
  });

  it("has idx_oauth_states_expiry", async () => {
    await migrate.up();

    const result = await pool.query<{ indexname: string }>(
      `SELECT indexname FROM pg_indexes WHERE tablename = 'oauth_states'`,
    );
    expect(result.rows.map((row) => row.indexname)).toContain("idx_oauth_states_expiry");
  });
});

import { PostgreSqlContainer, type StartedPostgreSqlContainer } from "@testcontainers/postgresql";
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";

// Per-migration test files assert schema content only (columns, constraints,
// cascades, indexes) - never the runner's down() semantics. down() always
// reverts "whatever was applied last", so a migration-specific down/up test
// breaks the moment a later migration exists. That generic, count-agnostic
// property is covered once in scripts/migrate.integration.test.ts.
describe("006_oauth_accounts migration (real Postgres)", () => {
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

  it("creates oauth_accounts with the exact columns, types, and nullability", async () => {
    await migrate.up();

    const result = await pool.query<{
      column_name: string;
      udt_name: string;
      is_nullable: string;
    }>(
      `SELECT column_name, udt_name, is_nullable
       FROM information_schema.columns
       WHERE table_name = 'oauth_accounts'
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
      { name: "provider", type: "oauth_provider", nullable: false },
      { name: "provider_user_id", type: "text", nullable: false },
      { name: "created_at", type: "timestamptz", nullable: false },
    ]);
  });

  it("enforces UNIQUE(provider, provider_user_id) but allows the same id under a different provider", async () => {
    await migrate.up();
    const userId = await insertUser("oauth-user@example.com");

    await pool.query(
      "INSERT INTO oauth_accounts (user_id, provider, provider_user_id) VALUES ($1, 'google', 'sub-123')",
      [userId],
    );

    await expect(
      pool.query(
        "INSERT INTO oauth_accounts (user_id, provider, provider_user_id) VALUES ($1, 'google', 'sub-123')",
        [userId],
      ),
    ).rejects.toThrow(/duplicate key value violates unique constraint/);

    await expect(
      pool.query(
        "INSERT INTO oauth_accounts (user_id, provider, provider_user_id) VALUES ($1, 'linkedin', 'sub-123')",
        [userId],
      ),
    ).resolves.toBeDefined();
  });

  it("cascades: deleting the user deletes their oauth accounts", async () => {
    await migrate.up();
    const userId = await insertUser("cascade-oauth@example.com");
    await pool.query(
      "INSERT INTO oauth_accounts (user_id, provider, provider_user_id) VALUES ($1, 'google', 'sub-456')",
      [userId],
    );

    await pool.query("DELETE FROM users WHERE id = $1", [userId]);

    const result = await pool.query("SELECT 1 FROM oauth_accounts WHERE user_id = $1", [userId]);
    expect(result.rows).toHaveLength(0);
  });

  it("has idx_oauth_user", async () => {
    await migrate.up();

    const result = await pool.query<{ indexname: string }>(
      `SELECT indexname FROM pg_indexes WHERE tablename = 'oauth_accounts'`,
    );
    expect(result.rows.map((row) => row.indexname)).toContain("idx_oauth_user");
  });
});

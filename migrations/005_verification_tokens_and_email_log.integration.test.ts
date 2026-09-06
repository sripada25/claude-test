import { PostgreSqlContainer, type StartedPostgreSqlContainer } from "@testcontainers/postgresql";
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";

// Per-migration test files assert schema content only (columns, constraints,
// cascades, indexes) - never the runner's down() semantics. down() always
// reverts "whatever was applied last", so a migration-specific down/up test
// breaks the moment a later migration exists. That generic, count-agnostic
// property is covered once in scripts/migrate.integration.test.ts.
describe("005_verification_tokens_and_email_log migration (real Postgres)", () => {
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

  async function columnsOf(table: string) {
    const result = await pool.query<{
      column_name: string;
      udt_name: string;
      is_nullable: string;
    }>(
      `SELECT column_name, udt_name, is_nullable
       FROM information_schema.columns
       WHERE table_name = $1
       ORDER BY ordinal_position`,
      [table],
    );
    return result.rows.map((row) => ({
      name: row.column_name,
      type: row.udt_name,
      nullable: row.is_nullable === "YES",
    }));
  }

  it("creates verification_tokens with the exact columns, types, and nullability", async () => {
    await migrate.up();

    expect(await columnsOf("verification_tokens")).toEqual([
      { name: "id", type: "uuid", nullable: false },
      { name: "user_id", type: "uuid", nullable: false },
      { name: "token_hash", type: "text", nullable: false },
      { name: "purpose", type: "token_purpose", nullable: false },
      { name: "new_email", type: "citext", nullable: true },
      { name: "attempts", type: "int2", nullable: false },
      { name: "expires_at", type: "timestamptz", nullable: false },
      { name: "used_at", type: "timestamptz", nullable: true },
      { name: "created_at", type: "timestamptz", nullable: false },
    ]);
  });

  it("creates email_log with the exact columns, types, and nullability", async () => {
    await migrate.up();

    expect(await columnsOf("email_log")).toEqual([
      { name: "id", type: "uuid", nullable: false },
      { name: "user_id", type: "uuid", nullable: true },
      { name: "recipient", type: "citext", nullable: false },
      { name: "purpose", type: "text", nullable: false },
      { name: "provider_message_id", type: "text", nullable: true },
      { name: "sent_at", type: "timestamptz", nullable: true },
      { name: "failed_at", type: "timestamptz", nullable: true },
      { name: "error", type: "text", nullable: true },
      { name: "created_at", type: "timestamptz", nullable: false },
    ]);
  });

  it("deleting a user cascades to verification_tokens but only nulls email_log.user_id", async () => {
    await migrate.up();
    const userId = await insertUser("verify-me@example.com");

    await pool.query(
      `INSERT INTO verification_tokens (user_id, token_hash, purpose, expires_at)
       VALUES ($1, 'hash', 'verify_email', now() + interval '10 minutes')`,
      [userId],
    );
    const emailLogResult = await pool.query<{ id: string }>(
      `INSERT INTO email_log (user_id, recipient, purpose)
       VALUES ($1, $2, 'verify_email') RETURNING id`,
      [userId, "verify-me@example.com"],
    );
    const emailLogId = emailLogResult.rows[0].id;

    await pool.query("DELETE FROM users WHERE id = $1", [userId]);

    const tokens = await pool.query("SELECT 1 FROM verification_tokens WHERE user_id = $1", [
      userId,
    ]);
    expect(tokens.rows).toHaveLength(0);

    const emailLog = await pool.query<{ user_id: string | null }>(
      "SELECT user_id FROM email_log WHERE id = $1",
      [emailLogId],
    );
    expect(emailLog.rows).toHaveLength(1);
    expect(emailLog.rows[0].user_id).toBeNull();
  });

  it("has both partial indexes with the correct WHERE clauses", async () => {
    await migrate.up();

    const tokenIndexes = await pool.query<{ indexname: string; indexdef: string }>(
      `SELECT indexname, indexdef FROM pg_indexes WHERE tablename = 'verification_tokens'`,
    );
    const tokenByName = Object.fromEntries(
      tokenIndexes.rows.map((row) => [row.indexname, row.indexdef]),
    );
    expect(tokenByName.idx_tokens_active).toContain("WHERE (used_at IS NULL)");

    const emailIndexes = await pool.query<{ indexname: string; indexdef: string }>(
      `SELECT indexname, indexdef FROM pg_indexes WHERE tablename = 'email_log'`,
    );
    const emailByName = Object.fromEntries(
      emailIndexes.rows.map((row) => [row.indexname, row.indexdef]),
    );
    expect(emailByName.idx_email_log_quota).toContain("WHERE (sent_at IS NOT NULL)");
  });
});

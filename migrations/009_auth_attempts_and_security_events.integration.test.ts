import { PostgreSqlContainer, type StartedPostgreSqlContainer } from "@testcontainers/postgresql";
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";

// Per-migration test files assert schema content only (columns, constraints,
// cascades, indexes) - never the runner's down() semantics. down() always
// reverts "whatever was applied last", so a migration-specific down/up test
// breaks the moment a later migration exists. That generic, count-agnostic
// property is covered once in scripts/migrate.integration.test.ts.
describe("009_auth_attempts_and_security_events migration (real Postgres)", () => {
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

  it("creates auth_attempts with the exact columns, types, and nullability", async () => {
    await migrate.up();

    expect(await columnsOf("auth_attempts")).toEqual([
      { name: "id", type: "int8", nullable: false },
      { name: "identifier", type: "text", nullable: false },
      { name: "succeeded", type: "bool", nullable: false },
      { name: "created_at", type: "timestamptz", nullable: false },
    ]);
  });

  it("creates security_events with the exact columns, types, and nullability", async () => {
    await migrate.up();

    expect(await columnsOf("security_events")).toEqual([
      { name: "id", type: "int8", nullable: false },
      { name: "event_type", type: "text", nullable: false },
      { name: "user_id", type: "uuid", nullable: true },
      { name: "ip", type: "inet", nullable: true },
      { name: "user_agent", type: "text", nullable: true },
      { name: "metadata", type: "jsonb", nullable: false },
      { name: "created_at", type: "timestamptz", nullable: false },
    ]);
  });

  it("accepts an auth_attempts row with no corresponding user at all", async () => {
    await migrate.up();

    await expect(
      pool.query(
        "INSERT INTO auth_attempts (identifier, succeeded) VALUES ($1, $2)",
        ["nobody@example.com", false],
      ),
    ).resolves.toBeDefined();

    const result = await pool.query("SELECT * FROM auth_attempts");
    expect(result.rows).toHaveLength(1);
  });

  it("sets security_events.user_id to NULL on user delete, without deleting the row", async () => {
    await migrate.up();
    const userId = await insertUser("audited-user@example.com");

    const inserted = await pool.query<{ id: string }>(
      "INSERT INTO security_events (event_type, user_id) VALUES ($1, $2) RETURNING id",
      ["login_success", userId],
    );

    await pool.query("DELETE FROM users WHERE id = $1", [userId]);

    const result = await pool.query<{ user_id: string | null }>(
      "SELECT user_id FROM security_events WHERE id = $1",
      [inserted.rows[0].id],
    );
    expect(result.rows).toHaveLength(1);
    expect(result.rows[0].user_id).toBeNull();
  });

  it("has all three indexes", async () => {
    await migrate.up();

    const authIndexes = await pool.query<{ indexname: string }>(
      `SELECT indexname FROM pg_indexes WHERE tablename = 'auth_attempts'`,
    );
    expect(authIndexes.rows.map((row) => row.indexname)).toContain("idx_auth_attempts");

    const eventIndexes = await pool.query<{ indexname: string }>(
      `SELECT indexname FROM pg_indexes WHERE tablename = 'security_events'`,
    );
    const eventIndexNames = eventIndexes.rows.map((row) => row.indexname);
    expect(eventIndexNames).toContain("idx_security_events");
    expect(eventIndexNames).toContain("idx_security_events_user");
  });
});

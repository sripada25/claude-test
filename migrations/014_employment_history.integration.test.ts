import { PostgreSqlContainer, type StartedPostgreSqlContainer } from "@testcontainers/postgresql";
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";

describe("014_employment_history migration (real Postgres)", () => {
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

  async function tableExists(table: string): Promise<boolean> {
    const result = await pool.query(
      `SELECT 1 FROM information_schema.tables WHERE table_name = $1`,
      [table],
    );
    return result.rows.length > 0;
  }

  it("creates employment_history with the exact columns, types, and nullability", async () => {
    await migrate.up();

    const result = await pool.query<{
      column_name: string;
      udt_name: string;
      is_nullable: string;
    }>(
      `SELECT column_name, udt_name, is_nullable
       FROM information_schema.columns
       WHERE table_name = 'employment_history'
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
      { name: "employer", type: "text", nullable: false },
      { name: "title", type: "text", nullable: false },
      { name: "start_date", type: "date", nullable: false },
      { name: "end_date", type: "date", nullable: true },
      { name: "created_at", type: "timestamptz", nullable: false },
      { name: "updated_at", type: "timestamptz", nullable: false },
    ]);
  });

  it("accepts a NULL end_date for a current position", async () => {
    await migrate.up();
    const userId = await insertUser("current-job@example.com");

    await expect(
      pool.query(
        `INSERT INTO employment_history (user_id, employer, title, start_date)
         VALUES ($1, 'Acme', 'Engineer', '2024-01-01')`,
        [userId],
      ),
    ).resolves.toBeDefined();
  });

  it("accepts an end_date on or after start_date", async () => {
    await migrate.up();
    const userId = await insertUser("valid-range@example.com");

    await expect(
      pool.query(
        `INSERT INTO employment_history (user_id, employer, title, start_date, end_date)
         VALUES ($1, 'Acme', 'Engineer', '2024-01-01', '2024-01-01')`,
        [userId],
      ),
    ).resolves.toBeDefined();
  });

  it("rejects an end_date before start_date", async () => {
    await migrate.up();
    const userId = await insertUser("invalid-range@example.com");

    await expect(
      pool.query(
        `INSERT INTO employment_history (user_id, employer, title, start_date, end_date)
         VALUES ($1, 'Acme', 'Engineer', '2024-06-01', '2024-01-01')`,
        [userId],
      ),
    ).rejects.toThrow();
  });

  it("cascades: deleting the user deletes their employment history", async () => {
    await migrate.up();
    const userId = await insertUser("cascade@example.com");
    await pool.query(
      `INSERT INTO employment_history (user_id, employer, title, start_date)
       VALUES ($1, 'Acme', 'Engineer', '2024-01-01')`,
      [userId],
    );

    await pool.query("DELETE FROM users WHERE id = $1", [userId]);

    const result = await pool.query("SELECT 1 FROM employment_history WHERE user_id = $1", [userId]);
    expect(result.rows).toHaveLength(0);
  });

  it("has idx_employment_history_user with the exact expected definition", async () => {
    await migrate.up();

    const result = await pool.query<{ indexdef: string }>(
      `SELECT indexdef FROM pg_indexes WHERE tablename = 'employment_history' AND indexname = 'idx_employment_history_user'`,
    );

    expect(result.rows).toHaveLength(1);
    expect(result.rows[0].indexdef).toContain("(user_id, start_date DESC)");
  });

  it("is fully reversible: down() drops the table, and up() re-applies cleanly", async () => {
    await migrate.up();

    // down() only reverts the single most-recently-applied migration, so
    // keep reverting until 014 itself is undone - resilient to any
    // migration added after this one.
    while (await tableExists("employment_history")) {
      await migrate.down();
    }
    expect(await tableExists("employment_history")).toBe(false);

    await expect(migrate.up()).resolves.not.toThrow();
    expect(await tableExists("employment_history")).toBe(true);
  });
});

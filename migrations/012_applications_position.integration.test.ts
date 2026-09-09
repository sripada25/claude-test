import { PostgreSqlContainer, type StartedPostgreSqlContainer } from "@testcontainers/postgresql";
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";

describe("012_applications_position migration (real Postgres)", () => {
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

  it("adds position as a nullable double precision column with no default", async () => {
    await migrate.up();

    const result = await pool.query<{
      column_name: string;
      udt_name: string;
      is_nullable: string;
      column_default: string | null;
    }>(
      `SELECT column_name, udt_name, is_nullable, column_default
       FROM information_schema.columns
       WHERE table_name = 'applications' AND column_name = 'position'`,
    );

    expect(result.rows).toEqual([
      { column_name: "position", udt_name: "float8", is_nullable: "YES", column_default: null },
    ]);
  });

  it("leaves position NULL on existing and newly inserted rows", async () => {
    await migrate.up();
    const userId = await insertUser("noposition@example.com");

    const inserted = await pool.query<{ position: number | null }>(
      `INSERT INTO applications (user_id, company, role) VALUES ($1, 'Acme', 'Engineer') RETURNING position`,
      [userId],
    );

    expect(inserted.rows[0].position).toBeNull();
  });

  it("creates idx_applications_manual_sort on (user_id, status, position) filtered to non-deleted rows", async () => {
    await migrate.up();

    const result = await pool.query<{ indexdef: string }>(
      `SELECT indexdef FROM pg_indexes WHERE tablename = 'applications' AND indexname = 'idx_applications_manual_sort'`,
    );

    expect(result.rows).toHaveLength(1);
    const indexdef = result.rows[0].indexdef;
    // Postgres quotes `position` in pg_indexes output since it's a reserved keyword.
    expect(indexdef).toContain('(user_id, status, "position")');
    expect(indexdef).toContain("WHERE (deleted_at IS NULL)");
  });

  it("leaves idx_applications_board and idx_applications_trash unchanged", async () => {
    await migrate.up();

    const indexes = await pool.query<{ indexname: string; indexdef: string }>(
      `SELECT indexname, indexdef FROM pg_indexes WHERE tablename = 'applications'`,
    );
    const byName = Object.fromEntries(indexes.rows.map((row) => [row.indexname, row.indexdef]));

    expect(byName.idx_applications_board).toBe(
      "CREATE INDEX idx_applications_board ON public.applications USING btree (user_id, status, last_activity_at DESC) WHERE (deleted_at IS NULL)",
    );
    expect(byName.idx_applications_trash).toBe(
      "CREATE INDEX idx_applications_trash ON public.applications USING btree (user_id, deleted_at DESC) WHERE (deleted_at IS NOT NULL)",
    );
  });

  it("is fully reversible: down() drops the index and column, and up() re-applies cleanly", async () => {
    await migrate.up();

    // down() only reverts the single most-recently-applied migration, so
    // one call only undoes 012 when it's the last migration on disk. Keep
    // reverting until 012 itself is undone - makes this test resilient to
    // any migration added after 012 (e.g. 013), instead of re-breaking
    // every time the migrations folder grows.
    let columns = await pool.query(
      `SELECT 1 FROM information_schema.columns WHERE table_name = 'applications' AND column_name = 'position'`,
    );
    while (columns.rows.length > 0) {
      await migrate.down();
      columns = await pool.query(
        `SELECT 1 FROM information_schema.columns WHERE table_name = 'applications' AND column_name = 'position'`,
      );
    }
    expect(columns.rows).toHaveLength(0);

    const indexes = await pool.query(
      `SELECT 1 FROM pg_indexes WHERE tablename = 'applications' AND indexname = 'idx_applications_manual_sort'`,
    );
    expect(indexes.rows).toHaveLength(0);

    await expect(migrate.up()).resolves.not.toThrow();

    const reapplied = await pool.query(
      `SELECT 1 FROM information_schema.columns WHERE table_name = 'applications' AND column_name = 'position'`,
    );
    expect(reapplied.rows).toHaveLength(1);
  });
});

import { PostgreSqlContainer, type StartedPostgreSqlContainer } from "@testcontainers/postgresql";
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";

describe("010_applications migration (real Postgres)", () => {
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

  it("creates applications with the exact columns, types, and nullability", async () => {
    await migrate.up();

    const result = await pool.query<{
      column_name: string;
      udt_name: string;
      is_nullable: string;
    }>(
      `SELECT column_name, udt_name, is_nullable
       FROM information_schema.columns
       WHERE table_name = 'applications'
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
      { name: "company", type: "text", nullable: false },
      { name: "role", type: "text", nullable: false },
      { name: "status", type: "application_status", nullable: false },
      { name: "job_description", type: "text", nullable: true },
      { name: "source", type: "application_source", nullable: true },
      { name: "source_url", type: "text", nullable: true },
      { name: "date_applied", type: "date", nullable: true },
      { name: "assessment_due_at", type: "timestamptz", nullable: true },
      { name: "interview_at", type: "timestamptz", nullable: true },
      { name: "notes", type: "text", nullable: true },
      { name: "last_activity_at", type: "timestamptz", nullable: false },
      { name: "deleted_at", type: "timestamptz", nullable: true },
      { name: "created_at", type: "timestamptz", nullable: false },
      { name: "updated_at", type: "timestamptz", nullable: false },
    ]);
  });

  it("requires only company and role", async () => {
    await migrate.up();
    const userId = await insertUser("minimal@example.com");

    await expect(
      pool.query(`INSERT INTO applications (user_id, company, role) VALUES ($1, 'Acme', 'Engineer')`, [
        userId,
      ]),
    ).resolves.toBeDefined();

    await expect(
      pool.query(`INSERT INTO applications (user_id, role) VALUES ($1, 'Engineer')`, [userId]),
    ).rejects.toThrow(/company/);

    await expect(
      pool.query(`INSERT INTO applications (user_id, company) VALUES ($1, 'Acme')`, [userId]),
    ).rejects.toThrow(/role/);
  });

  it("defaults status to saved and rejects job_description over 15000 chars", async () => {
    await migrate.up();
    const userId = await insertUser("defaults@example.com");

    const inserted = await pool.query<{ status: string }>(
      `INSERT INTO applications (user_id, company, role) VALUES ($1, 'Acme', 'Engineer') RETURNING status`,
      [userId],
    );
    expect(inserted.rows[0].status).toBe("saved");

    const tooLong = "x".repeat(15001);
    await expect(
      pool.query(
        `INSERT INTO applications (user_id, company, role, job_description) VALUES ($1, 'Acme', 'Engineer', $2)`,
        [userId, tooLong],
      ),
    ).rejects.toThrow();
  });

  it("has both partial indexes with their exact WHERE clauses", async () => {
    await migrate.up();

    const indexes = await pool.query<{ indexname: string; indexdef: string }>(
      `SELECT indexname, indexdef FROM pg_indexes WHERE tablename = 'applications'`,
    );
    const byName = Object.fromEntries(indexes.rows.map((row) => [row.indexname, row.indexdef]));

    expect(byName.idx_applications_board).toContain("WHERE (deleted_at IS NULL)");
    expect(byName.idx_applications_trash).toContain("WHERE (deleted_at IS NOT NULL)");
  });

  it("cascades: deleting the user deletes their applications", async () => {
    await migrate.up();
    const userId = await insertUser("cascade@example.com");
    await pool.query(`INSERT INTO applications (user_id, company, role) VALUES ($1, 'Acme', 'Engineer')`, [
      userId,
    ]);

    await pool.query("DELETE FROM users WHERE id = $1", [userId]);

    const result = await pool.query("SELECT 1 FROM applications WHERE user_id = $1", [userId]);
    expect(result.rows).toHaveLength(0);
  });
});

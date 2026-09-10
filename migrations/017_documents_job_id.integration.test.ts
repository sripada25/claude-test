import { PostgreSqlContainer, type StartedPostgreSqlContainer } from "@testcontainers/postgresql";
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";

describe("017_documents_job_id migration (real Postgres)", () => {
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

  async function columnExists(table: string, column: string): Promise<boolean> {
    const result = await pool.query(
      `SELECT 1 FROM information_schema.columns WHERE table_name = $1 AND column_name = $2`,
      [table, column],
    );
    return result.rows.length > 0;
  }

  it("adds job_id as a nullable uuid column", async () => {
    await migrate.up();

    const result = await pool.query<{ udt_name: string; is_nullable: string }>(
      `SELECT udt_name, is_nullable FROM information_schema.columns
       WHERE table_name = 'documents' AND column_name = 'job_id'`,
    );

    expect(result.rows).toEqual([{ udt_name: "uuid", is_nullable: "YES" }]);
  });

  it("leaves existing rows with a NULL job_id", async () => {
    await migrate.up();
    const userResult = await pool.query<{ id: string }>(
      "INSERT INTO users (email, timezone) VALUES ($1, 'Asia/Kolkata') RETURNING id",
      ["existing-row@example.com"],
    );
    const applicationResult = await pool.query<{ id: string }>(
      "INSERT INTO applications (user_id, company, role) VALUES ($1, 'Acme', 'Engineer') RETURNING id",
      [userResult.rows[0].id],
    );
    const documentResult = await pool.query<{ job_id: string | null }>(
      `INSERT INTO documents (application_id, user_id, type, content, provider, model)
       VALUES ($1, $2, 'cover_letter', 'content', 'gemini', 'gemini-flash-latest') RETURNING job_id`,
      [applicationResult.rows[0].id, userResult.rows[0].id],
    );

    expect(documentResult.rows[0].job_id).toBeNull();
  });

  it("is fully reversible: down() drops the column, and up() re-applies cleanly", async () => {
    await migrate.up();

    while (await columnExists("documents", "job_id")) {
      await migrate.down();
    }
    expect(await columnExists("documents", "job_id")).toBe(false);

    await expect(migrate.up()).resolves.not.toThrow();
    expect(await columnExists("documents", "job_id")).toBe(true);
  });
});

import { PostgreSqlContainer, type StartedPostgreSqlContainer } from "@testcontainers/postgresql";
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";

describe("015_generation_jobs_retry migration (real Postgres)", () => {
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

  it("adds next_attempt_at as a nullable timestamptz", async () => {
    await migrate.up();

    const result = await pool.query<{ udt_name: string; is_nullable: string }>(
      `SELECT udt_name, is_nullable FROM information_schema.columns
       WHERE table_name = 'generation_jobs' AND column_name = 'next_attempt_at'`,
    );

    expect(result.rows).toEqual([{ udt_name: "timestamptz", is_nullable: "YES" }]);
  });

  it("leaves existing rows with a NULL next_attempt_at", async () => {
    await migrate.up();
    const userResult = await pool.query<{ id: string }>(
      "INSERT INTO users (email, timezone) VALUES ($1, 'Asia/Kolkata') RETURNING id",
      ["existing-row@example.com"],
    );
    const applicationResult = await pool.query<{ id: string }>(
      "INSERT INTO applications (user_id, company, role) VALUES ($1, 'Acme', 'Engineer') RETURNING id",
      [userResult.rows[0].id],
    );
    const jobResult = await pool.query<{ next_attempt_at: Date | null }>(
      `INSERT INTO generation_jobs (user_id, application_id, type, prompt_inputs)
       VALUES ($1, $2, 'cover_letter', '{}') RETURNING next_attempt_at`,
      [userResult.rows[0].id, applicationResult.rows[0].id],
    );

    expect(jobResult.rows[0].next_attempt_at).toBeNull();
  });

  it("is fully reversible: down() drops the column, and up() re-applies cleanly", async () => {
    await migrate.up();

    // down() only reverts the single most-recently-applied migration, so
    // keep reverting until 015 itself is undone - resilient to any
    // migration added after this one.
    while (await columnExists("generation_jobs", "next_attempt_at")) {
      await migrate.down();
    }
    expect(await columnExists("generation_jobs", "next_attempt_at")).toBe(false);

    await expect(migrate.up()).resolves.not.toThrow();
    expect(await columnExists("generation_jobs", "next_attempt_at")).toBe(true);
  });
});

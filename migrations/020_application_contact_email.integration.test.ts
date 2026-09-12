import { PostgreSqlContainer, type StartedPostgreSqlContainer } from "@testcontainers/postgresql";
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";

describe("020_application_contact_email migration (real Postgres)", () => {
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

  it("adds applications.contact_email as a nullable citext", async () => {
    await migrate.up();

    const result = await pool.query<{ udt_name: string; is_nullable: string }>(
      `SELECT udt_name, is_nullable FROM information_schema.columns
       WHERE table_name = 'applications' AND column_name = 'contact_email'`,
    );

    expect(result.rows).toEqual([{ udt_name: "citext", is_nullable: "YES" }]);
  });

  it("leaves existing applications with a NULL contact_email", async () => {
    await migrate.up();
    const userResult = await pool.query<{ id: string }>(
      `INSERT INTO users (email, timezone) VALUES ($1, 'Asia/Kolkata') RETURNING id`,
      ["existing-application@example.com"],
    );
    const applicationResult = await pool.query<{ contact_email: string | null }>(
      `INSERT INTO applications (user_id, company, role) VALUES ($1, 'Acme', 'Engineer') RETURNING contact_email`,
      [userResult.rows[0].id],
    );

    expect(applicationResult.rows[0].contact_email).toBeNull();
  });

  it("is case-insensitive, matching profiles.contact_email's existing citext convention", async () => {
    await migrate.up();
    const userResult = await pool.query<{ id: string }>(
      `INSERT INTO users (email, timezone) VALUES ($1, 'Asia/Kolkata') RETURNING id`,
      ["case-insensitive@example.com"],
    );
    await pool.query(
      `INSERT INTO applications (user_id, company, role, contact_email) VALUES ($1, 'Acme', 'Engineer', 'Priya.Singh@Razorpay.com')`,
      [userResult.rows[0].id],
    );

    const result = await pool.query(
      `SELECT 1 FROM applications WHERE user_id = $1 AND contact_email = 'priya.singh@razorpay.com'`,
      [userResult.rows[0].id],
    );
    expect(result.rows).toHaveLength(1);
  });

  it("is fully reversible: down() drops the column, and up() re-applies cleanly", async () => {
    await migrate.up();

    while (await columnExists("applications", "contact_email")) {
      await migrate.down();
    }
    expect(await columnExists("applications", "contact_email")).toBe(false);

    await expect(migrate.up()).resolves.not.toThrow();
    expect(await columnExists("applications", "contact_email")).toBe(true);
  });
});

import { PostgreSqlContainer, type StartedPostgreSqlContainer } from "@testcontainers/postgresql";
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";

describe("021_profile_contact_email_verified migration (real Postgres)", () => {
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

  it("adds profiles.contact_email_verified_at as a nullable timestamptz", async () => {
    await migrate.up();

    const result = await pool.query<{ data_type: string; is_nullable: string }>(
      `SELECT data_type, is_nullable FROM information_schema.columns
       WHERE table_name = 'profiles' AND column_name = 'contact_email_verified_at'`,
    );

    expect(result.rows).toEqual([{ data_type: "timestamp with time zone", is_nullable: "YES" }]);
  });

  it("leaves existing profiles with a NULL contact_email_verified_at", async () => {
    await migrate.up();
    const userResult = await pool.query<{ id: string }>(
      `INSERT INTO users (email, timezone) VALUES ($1, 'Asia/Kolkata') RETURNING id`,
      ["existing-profile@example.com"],
    );
    const profileResult = await pool.query<{ contact_email_verified_at: Date | null }>(
      `INSERT INTO profiles (user_id, full_name) VALUES ($1, 'Aakriti Kapoor') RETURNING contact_email_verified_at`,
      [userResult.rows[0].id],
    );

    expect(profileResult.rows[0].contact_email_verified_at).toBeNull();
  });

  it("is fully reversible: down() drops the column, and up() re-applies cleanly", async () => {
    await migrate.up();

    while (await columnExists("profiles", "contact_email_verified_at")) {
      await migrate.down();
    }
    expect(await columnExists("profiles", "contact_email_verified_at")).toBe(false);

    await expect(migrate.up()).resolves.not.toThrow();
    expect(await columnExists("profiles", "contact_email_verified_at")).toBe(true);
  });
});

import { PostgreSqlContainer, type StartedPostgreSqlContainer } from "@testcontainers/postgresql";
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";

// Per-migration test files assert schema content only (columns, constraints,
// cascades) - never the runner's down() semantics. down() always reverts
// "whatever was applied last", so a migration-specific down/up test breaks
// the moment a later migration exists. That generic, count-agnostic property
// is covered once in scripts/migrate.integration.test.ts.
describe("003_profiles migration (real Postgres)", () => {
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

  it("creates profiles with the exact columns, types, and nullability", async () => {
    await migrate.up();

    const result = await pool.query<{
      column_name: string;
      udt_name: string;
      is_nullable: string;
    }>(
      `SELECT column_name, udt_name, is_nullable
       FROM information_schema.columns
       WHERE table_name = 'profiles'
       ORDER BY ordinal_position`,
    );

    const columns = result.rows.map((row) => ({
      name: row.column_name,
      type: row.udt_name,
      nullable: row.is_nullable === "YES",
    }));

    expect(columns).toEqual([
      { name: "user_id", type: "uuid", nullable: false },
      { name: "full_name", type: "text", nullable: false },
      { name: "current_role", type: "text", nullable: true },
      { name: "target_role", type: "text", nullable: true },
      { name: "contact_email", type: "citext", nullable: true },
      { name: "years_experience", type: "int2", nullable: true },
      { name: "months_experience", type: "int2", nullable: true },
      { name: "skills", type: "_text", nullable: false },
      { name: "salary_amount", type: "numeric", nullable: true },
      { name: "salary_currency", type: "bpchar", nullable: true },
      { name: "salary_period", type: "salary_period", nullable: true },
      { name: "location_preference", type: "location_pref", nullable: true },
      { name: "source", type: "profile_source", nullable: false },
      { name: "completed_at", type: "timestamptz", nullable: true },
      { name: "created_at", type: "timestamptz", nullable: false },
      { name: "updated_at", type: "timestamptz", nullable: false },
    ]);
  });

  it("rejects a partial salary triple but accepts all-NULL or all-set", async () => {
    await migrate.up();
    const userId = await insertUser("complete-salary@example.com");

    await expect(
      pool.query(
        `INSERT INTO profiles (user_id, full_name, salary_amount)
         VALUES ($1, 'Partial Salary', 100000)`,
        [userId],
      ),
    ).rejects.toThrow(/salary_complete/);

    await expect(
      pool.query(
        `INSERT INTO profiles (user_id, full_name)
         VALUES ($1, 'No Salary')`,
        [userId],
      ),
    ).resolves.toBeDefined();

    const userId2 = await insertUser("full-salary@example.com");
    await expect(
      pool.query(
        `INSERT INTO profiles (user_id, full_name, salary_amount, salary_currency, salary_period)
         VALUES ($1, 'Full Salary', 2800000, 'INR', 'annual')`,
        [userId2],
      ),
    ).resolves.toBeDefined();
  });

  it("cascades: deleting the user deletes their profile", async () => {
    await migrate.up();
    const userId = await insertUser("cascade@example.com");
    await pool.query("INSERT INTO profiles (user_id, full_name) VALUES ($1, 'Cascade Test')", [
      userId,
    ]);

    await pool.query("DELETE FROM users WHERE id = $1", [userId]);

    const result = await pool.query("SELECT 1 FROM profiles WHERE user_id = $1", [userId]);
    expect(result.rows).toHaveLength(0);
  });
});

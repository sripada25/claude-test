import { PostgreSqlContainer, type StartedPostgreSqlContainer } from "@testcontainers/postgresql";
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";

describe("018_reminders migration (real Postgres)", () => {
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

  async function insertUser(email: string): Promise<string> {
    const result = await pool.query<{ id: string }>(
      `INSERT INTO users (email, timezone) VALUES ($1, 'Asia/Kolkata') RETURNING id`,
      [email],
    );
    return result.rows[0].id;
  }

  async function insertApplication(userId: string): Promise<string> {
    const result = await pool.query<{ id: string }>(
      `INSERT INTO applications (user_id, company, role) VALUES ($1, 'Acme', 'Engineer') RETURNING id`,
      [userId],
    );
    return result.rows[0].id;
  }

  it("creates reminders with the exact expected columns, types, and nullability", async () => {
    await migrate.up();

    const result = await pool.query<{
      column_name: string;
      udt_name: string;
      is_nullable: string;
      column_default: string | null;
    }>(
      `SELECT column_name, udt_name, is_nullable, column_default
       FROM information_schema.columns
       WHERE table_name = 'reminders'
       ORDER BY ordinal_position`,
    );

    expect(result.rows).toEqual([
      { column_name: "id", udt_name: "uuid", is_nullable: "NO", column_default: "gen_random_uuid()" },
      { column_name: "user_id", udt_name: "uuid", is_nullable: "NO", column_default: null },
      { column_name: "application_id", udt_name: "uuid", is_nullable: "NO", column_default: null },
      { column_name: "type", udt_name: "reminder_type", is_nullable: "NO", column_default: null },
      {
        column_name: "status",
        udt_name: "reminder_status",
        is_nullable: "NO",
        column_default: "'pending'::reminder_status",
      },
      { column_name: "due_at", udt_name: "timestamptz", is_nullable: "NO", column_default: null },
      { column_name: "snoozed_until", udt_name: "timestamptz", is_nullable: "YES", column_default: null },
      { column_name: "draft_content", udt_name: "text", is_nullable: "YES", column_default: null },
      { column_name: "sent_at", udt_name: "timestamptz", is_nullable: "YES", column_default: null },
      { column_name: "dismissed_at", udt_name: "timestamptz", is_nullable: "YES", column_default: null },
      { column_name: "created_at", udt_name: "timestamptz", is_nullable: "NO", column_default: "now()" },
      { column_name: "updated_at", udt_name: "timestamptz", is_nullable: "NO", column_default: "now()" },
      { column_name: "notified_at", udt_name: "timestamptz", is_nullable: "YES", column_default: null },
    ]);
  });

  it("defines reminder_type and reminder_status enums with the exact expected values", async () => {
    await migrate.up();

    const typeValues = await pool.query<{ enumlabel: string }>(
      `SELECT enumlabel FROM pg_enum
       JOIN pg_type ON pg_enum.enumtypid = pg_type.oid
       WHERE pg_type.typname = 'reminder_type' ORDER BY enumsortorder`,
    );
    expect(typeValues.rows.map((r) => r.enumlabel)).toEqual(["application_followup", "post_interview"]);

    const statusValues = await pool.query<{ enumlabel: string }>(
      `SELECT enumlabel FROM pg_enum
       JOIN pg_type ON pg_enum.enumtypid = pg_type.oid
       WHERE pg_type.typname = 'reminder_status' ORDER BY enumsortorder`,
    );
    expect(statusValues.rows.map((r) => r.enumlabel)).toEqual(["pending", "snoozed", "sent", "dismissed"]);
  });

  it("defaults status to pending", async () => {
    await migrate.up();
    const userId = await insertUser("default-status@example.com");
    const applicationId = await insertApplication(userId);

    const result = await pool.query<{ status: string }>(
      `INSERT INTO reminders (user_id, application_id, type, due_at)
       VALUES ($1, $2, 'application_followup', now()) RETURNING status`,
      [userId, applicationId],
    );

    expect(result.rows[0].status).toBe("pending");
  });

  it("enforces UNIQUE (application_id, type) - rejects a duplicate rule for the same application", async () => {
    await migrate.up();
    const userId = await insertUser("duplicate-rule@example.com");
    const applicationId = await insertApplication(userId);

    await pool.query(
      `INSERT INTO reminders (user_id, application_id, type, due_at) VALUES ($1, $2, 'application_followup', now())`,
      [userId, applicationId],
    );

    await expect(
      pool.query(
        `INSERT INTO reminders (user_id, application_id, type, due_at) VALUES ($1, $2, 'application_followup', now())`,
        [userId, applicationId],
      ),
    ).rejects.toThrow();
  });

  it("allows both reminder types for the same application", async () => {
    await migrate.up();
    const userId = await insertUser("both-types@example.com");
    const applicationId = await insertApplication(userId);

    await pool.query(
      `INSERT INTO reminders (user_id, application_id, type, due_at) VALUES ($1, $2, 'application_followup', now())`,
      [userId, applicationId],
    );

    await expect(
      pool.query(
        `INSERT INTO reminders (user_id, application_id, type, due_at) VALUES ($1, $2, 'post_interview', now())`,
        [userId, applicationId],
      ),
    ).resolves.not.toThrow();
  });

  it("creates idx_reminders_queue as a partial index on (user_id, due_at)", async () => {
    await migrate.up();

    const result = await pool.query<{ indexdef: string }>(
      `SELECT indexdef FROM pg_indexes WHERE indexname = 'idx_reminders_queue'`,
    );

    expect(result.rows).toHaveLength(1);
    expect(result.rows[0].indexdef).toContain("(user_id, due_at)");
    expect(result.rows[0].indexdef).toContain("WHERE");
    expect(result.rows[0].indexdef).toContain("status");
  });

  it("adds follow_up_snoozed_until to applications as a nullable timestamptz", async () => {
    await migrate.up();

    const result = await pool.query<{ udt_name: string; is_nullable: string }>(
      `SELECT udt_name, is_nullable FROM information_schema.columns
       WHERE table_name = 'applications' AND column_name = 'follow_up_snoozed_until'`,
    );

    expect(result.rows).toEqual([{ udt_name: "timestamptz", is_nullable: "YES" }]);
  });

  it("cascades from users to reminders on delete", async () => {
    await migrate.up();
    const userId = await insertUser("cascade-user@example.com");
    const applicationId = await insertApplication(userId);
    await pool.query(
      `INSERT INTO reminders (user_id, application_id, type, due_at) VALUES ($1, $2, 'application_followup', now())`,
      [userId, applicationId],
    );

    await pool.query(`DELETE FROM users WHERE id = $1`, [userId]);

    const result = await pool.query(`SELECT 1 FROM reminders WHERE user_id = $1`, [userId]);
    expect(result.rows).toHaveLength(0);
  });

  it("cascades from applications to reminders on delete", async () => {
    await migrate.up();
    const userId = await insertUser("cascade-application@example.com");
    const applicationId = await insertApplication(userId);
    await pool.query(
      `INSERT INTO reminders (user_id, application_id, type, due_at) VALUES ($1, $2, 'application_followup', now())`,
      [userId, applicationId],
    );

    await pool.query(`DELETE FROM applications WHERE id = $1`, [applicationId]);

    const result = await pool.query(`SELECT 1 FROM reminders WHERE application_id = $1`, [applicationId]);
    expect(result.rows).toHaveLength(0);
  });

  it("is fully reversible: down() removes the table, both enums, and the applications column, and up() re-applies cleanly", async () => {
    await migrate.up();

    while (await columnExists("applications", "follow_up_snoozed_until")) {
      await migrate.down();
    }

    const tableResult = await pool.query(
      `SELECT 1 FROM information_schema.tables WHERE table_name = 'reminders'`,
    );
    expect(tableResult.rows).toHaveLength(0);

    const enumResult = await pool.query(
      `SELECT 1 FROM pg_type WHERE typname IN ('reminder_type', 'reminder_status')`,
    );
    expect(enumResult.rows).toHaveLength(0);

    await expect(migrate.up()).resolves.not.toThrow();
    expect(await columnExists("applications", "follow_up_snoozed_until")).toBe(true);
  });
});

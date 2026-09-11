import { PostgreSqlContainer, type StartedPostgreSqlContainer } from "@testcontainers/postgresql";
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";

describe("019_reminder_notifications migration (real Postgres)", () => {
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

  it("adds users.reminder_emails_enabled as a NOT NULL boolean defaulting to true", async () => {
    await migrate.up();

    const result = await pool.query<{ udt_name: string; is_nullable: string; column_default: string | null }>(
      `SELECT udt_name, is_nullable, column_default FROM information_schema.columns
       WHERE table_name = 'users' AND column_name = 'reminder_emails_enabled'`,
    );

    expect(result.rows).toEqual([{ udt_name: "bool", is_nullable: "NO", column_default: "true" }]);
  });

  it("defaults existing and new users to reminder_emails_enabled = true", async () => {
    await migrate.up();

    const result = await pool.query<{ reminder_emails_enabled: boolean }>(
      `INSERT INTO users (email, timezone) VALUES ($1, 'Asia/Kolkata') RETURNING reminder_emails_enabled`,
      ["default-enabled@example.com"],
    );

    expect(result.rows[0].reminder_emails_enabled).toBe(true);
  });

  it("adds reminders.notified_at as a nullable timestamptz", async () => {
    await migrate.up();

    const result = await pool.query<{ udt_name: string; is_nullable: string }>(
      `SELECT udt_name, is_nullable FROM information_schema.columns
       WHERE table_name = 'reminders' AND column_name = 'notified_at'`,
    );

    expect(result.rows).toEqual([{ udt_name: "timestamptz", is_nullable: "YES" }]);
  });

  it("leaves existing reminders with a NULL notified_at", async () => {
    await migrate.up();
    const userResult = await pool.query<{ id: string }>(
      `INSERT INTO users (email, timezone) VALUES ($1, 'Asia/Kolkata') RETURNING id`,
      ["existing-reminder@example.com"],
    );
    const applicationResult = await pool.query<{ id: string }>(
      `INSERT INTO applications (user_id, company, role) VALUES ($1, 'Acme', 'Engineer') RETURNING id`,
      [userResult.rows[0].id],
    );
    const reminderResult = await pool.query<{ notified_at: Date | null }>(
      `INSERT INTO reminders (user_id, application_id, type, due_at)
       VALUES ($1, $2, 'application_followup', now()) RETURNING notified_at`,
      [userResult.rows[0].id, applicationResult.rows[0].id],
    );

    expect(reminderResult.rows[0].notified_at).toBeNull();
  });

  it("is fully reversible: down() drops both columns, and up() re-applies cleanly", async () => {
    await migrate.up();

    while (await columnExists("reminders", "notified_at")) {
      await migrate.down();
    }
    expect(await columnExists("reminders", "notified_at")).toBe(false);
    expect(await columnExists("users", "reminder_emails_enabled")).toBe(false);

    await expect(migrate.up()).resolves.not.toThrow();
    expect(await columnExists("reminders", "notified_at")).toBe(true);
    expect(await columnExists("users", "reminder_emails_enabled")).toBe(true);
  });
});

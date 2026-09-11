import { PostgreSqlContainer, type StartedPostgreSqlContainer } from "@testcontainers/postgresql";
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";
import { localDateString, zonedTimeToUtc } from "./reminder-time.ts";

describe("reminder scheduler (real Postgres)", () => {
  let container: StartedPostgreSqlContainer;
  let migrate: typeof import("../../scripts/migrate.ts");
  let pool: typeof import("../db.ts")["pool"];
  let runReminderSweep: typeof import("./reminder-scheduler.ts")["runReminderSweep"];

  beforeAll(async () => {
    container = await new PostgreSqlContainer("postgres:16-alpine").start();
    process.env.DATABASE_URL = container.getConnectionUri();

    migrate = await import("../../scripts/migrate.ts");
    ({ pool } = await import("../db.ts"));
    ({ runReminderSweep } = await import("./reminder-scheduler.ts"));

    await migrate.up();
  }, 60_000);

  afterEach(async () => {
    await pool.query("DELETE FROM users");
  });

  afterAll(async () => {
    await pool.end();
    await container.stop();
  });

  async function insertUser(email: string, timezone: string): Promise<string> {
    const result = await pool.query<{ id: string }>(`INSERT INTO users (email, timezone) VALUES ($1, $2) RETURNING id`, [
      email,
      timezone,
    ]);
    return result.rows[0].id;
  }

  async function insertApplication(params: {
    userId: string;
    dateApplied?: string | null;
    status?: string;
    interviewAt?: Date | null;
    deletedAt?: Date | null;
  }): Promise<string> {
    const result = await pool.query<{ id: string }>(
      `INSERT INTO applications (user_id, company, role, status, date_applied, interview_at, deleted_at)
       VALUES ($1, 'Acme', 'Engineer', $2, $3, $4, $5) RETURNING id`,
      [
        params.userId,
        params.status ?? "applied",
        params.dateApplied ?? null,
        params.interviewAt ?? null,
        params.deletedAt ?? null,
      ],
    );
    return result.rows[0].id;
  }

  async function findReminder(applicationId: string, type: string): Promise<{ status: string; due_at: Date } | null> {
    const result = await pool.query<{ status: string; due_at: Date }>(
      `SELECT status, due_at FROM reminders WHERE application_id = $1 AND type = $2`,
      [applicationId, type],
    );
    return result.rows[0] ?? null;
  }

  async function countReminders(applicationId: string, type: string): Promise<number> {
    const result = await pool.query<{ count: string }>(
      `SELECT count(*) FROM reminders WHERE application_id = $1 AND type = $2`,
      [applicationId, type],
    );
    return Number(result.rows[0].count);
  }

  describe("R1 - application follow-up", () => {
    it("fires for an application exactly 7 days old in the user's own timezone, with the correct due_at", async () => {
      const userId = await insertUser("r1-kolkata@example.com", "Asia/Kolkata");
      const sevenDaysAgo = localDateString("Asia/Kolkata", 7);
      const applicationId = await insertApplication({ userId, dateApplied: sevenDaysAgo, status: "applied" });

      await runReminderSweep();

      const reminder = await findReminder(applicationId, "application_followup");
      expect(reminder).not.toBeNull();
      expect(reminder?.status).toBe("pending");

      const today = localDateString("Asia/Kolkata", 0);
      const [year, month, day] = today.split("-").map(Number);
      const expectedDueAt = zonedTimeToUtc(year, month, day, 9, "Asia/Kolkata");
      expect(new Date(reminder!.due_at).getTime()).toBe(expectedDueAt.getTime());
    });

    it("does not fire a day early or a day late", async () => {
      const userId = await insertUser("r1-boundary@example.com", "America/New_York");
      const sixDaysAgo = localDateString("America/New_York", 6);
      const eightDaysAgo = localDateString("America/New_York", 8);
      const tooEarly = await insertApplication({ userId, dateApplied: sixDaysAgo, status: "applied" });
      const tooLate = await insertApplication({ userId, dateApplied: eightDaysAgo, status: "applied" });

      await runReminderSweep();

      expect(await findReminder(tooEarly, "application_followup")).toBeNull();
      expect(await findReminder(tooLate, "application_followup")).toBeNull();
    });

    it("does not fire for a non-qualifying status", async () => {
      const userId = await insertUser("r1-status@example.com", "UTC");
      const sevenDaysAgo = localDateString("UTC", 7);
      const applicationId = await insertApplication({ userId, dateApplied: sevenDaysAgo, status: "offer" });

      await runReminderSweep();

      expect(await findReminder(applicationId, "application_followup")).toBeNull();
    });

    it("does not fire for a deleted application", async () => {
      const userId = await insertUser("r1-deleted@example.com", "UTC");
      const sevenDaysAgo = localDateString("UTC", 7);
      const applicationId = await insertApplication({
        userId,
        dateApplied: sevenDaysAgo,
        status: "applied",
        deletedAt: new Date(),
      });

      await runReminderSweep();

      expect(await findReminder(applicationId, "application_followup")).toBeNull();
    });

    it("does not insert a duplicate on a second sweep", async () => {
      const userId = await insertUser("r1-dup@example.com", "UTC");
      const sevenDaysAgo = localDateString("UTC", 7);
      const applicationId = await insertApplication({ userId, dateApplied: sevenDaysAgo, status: "applied" });

      await runReminderSweep();
      await runReminderSweep();

      expect(await countReminders(applicationId, "application_followup")).toBe(1);
    });
  });

  describe("R2 - post-interview follow-up", () => {
    it("fires for an interview inside the 24-25h window, with due_at = interview_at + 24h", async () => {
      const userId = await insertUser("r2-window@example.com", "UTC");
      const interviewAt = new Date(Date.now() - 24.5 * 60 * 60 * 1000);
      const applicationId = await insertApplication({ userId, status: "interview", interviewAt });

      await runReminderSweep();

      const reminder = await findReminder(applicationId, "post_interview");
      expect(reminder).not.toBeNull();
      const expectedDueAt = new Date(interviewAt.getTime() + 24 * 60 * 60 * 1000);
      expect(new Date(reminder!.due_at).getTime()).toBe(expectedDueAt.getTime());
    });

    it("does not fire before the window (23 hours ago)", async () => {
      const userId = await insertUser("r2-early@example.com", "UTC");
      const interviewAt = new Date(Date.now() - 23 * 60 * 60 * 1000);
      const applicationId = await insertApplication({ userId, status: "interview", interviewAt });

      await runReminderSweep();

      expect(await findReminder(applicationId, "post_interview")).toBeNull();
    });

    it("does not fire after the window (26 hours ago)", async () => {
      const userId = await insertUser("r2-late@example.com", "UTC");
      const interviewAt = new Date(Date.now() - 26 * 60 * 60 * 1000);
      const applicationId = await insertApplication({ userId, status: "interview", interviewAt });

      await runReminderSweep();

      expect(await findReminder(applicationId, "post_interview")).toBeNull();
    });

    it("never fires when interview_at is null", async () => {
      const userId = await insertUser("r2-null@example.com", "UTC");
      const applicationId = await insertApplication({ userId, status: "interview", interviewAt: null });

      await runReminderSweep();

      expect(await findReminder(applicationId, "post_interview")).toBeNull();
    });

    it("does not fire for a deleted application", async () => {
      const userId = await insertUser("r2-deleted@example.com", "UTC");
      const interviewAt = new Date(Date.now() - 24.5 * 60 * 60 * 1000);
      const applicationId = await insertApplication({
        userId,
        status: "interview",
        interviewAt,
        deletedAt: new Date(),
      });

      await runReminderSweep();

      expect(await findReminder(applicationId, "post_interview")).toBeNull();
    });

    it("does not insert a duplicate on a second sweep", async () => {
      const userId = await insertUser("r2-dup@example.com", "UTC");
      const interviewAt = new Date(Date.now() - 24.5 * 60 * 60 * 1000);
      const applicationId = await insertApplication({ userId, status: "interview", interviewAt });

      await runReminderSweep();
      await runReminderSweep();

      expect(await countReminders(applicationId, "post_interview")).toBe(1);
    });
  });
});

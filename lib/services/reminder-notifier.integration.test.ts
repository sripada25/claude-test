import { PostgreSqlContainer, type StartedPostgreSqlContainer } from "@testcontainers/postgresql";
import { GenericContainer, type StartedTestContainer, Wait } from "testcontainers";
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";

interface MailpitMessageSummary {
  ID: string;
}

interface MailpitMessage {
  To: { Address: string }[];
  Subject: string;
}

describe("reminder notifier (real Postgres + Mailpit)", () => {
  let pgContainer: StartedPostgreSqlContainer;
  let mailpitContainer: StartedTestContainer;
  let mailpitHttpBase: string;
  let migrate: typeof import("../../scripts/migrate.ts");
  let pool: typeof import("../db.ts")["pool"];
  let runNotificationTick: typeof import("./reminder-notifier.ts")["runNotificationTick"];

  beforeAll(async () => {
    pgContainer = await new PostgreSqlContainer("postgres:16-alpine").start();
    mailpitContainer = await new GenericContainer("axllent/mailpit:latest")
      .withExposedPorts(1025, 8025)
      .withWaitStrategy(Wait.forListeningPorts())
      .start();

    process.env.DATABASE_URL = pgContainer.getConnectionUri();
    process.env.SMTP_HOST = mailpitContainer.getHost();
    process.env.SMTP_PORT = String(mailpitContainer.getMappedPort(1025));
    process.env.EMAIL_FROM = "test@trackr.app";

    mailpitHttpBase = `http://${mailpitContainer.getHost()}:${mailpitContainer.getMappedPort(8025)}`;

    migrate = await import("../../scripts/migrate.ts");
    ({ pool } = await import("../db.ts"));
    ({ runNotificationTick } = await import("./reminder-notifier.ts"));

    await migrate.up();
  }, 90_000);

  afterEach(async () => {
    await pool.query("DELETE FROM reminders");
    await pool.query("DELETE FROM email_log");
    await pool.query("DELETE FROM applications");
    await pool.query("DELETE FROM users");
    await fetch(`${mailpitHttpBase}/api/v1/messages`, { method: "DELETE" });
  });

  afterAll(async () => {
    await pool.end();
    await pgContainer.stop();
    await mailpitContainer.stop();
  });

  async function insertUser(email: string, reminderEmailsEnabled = true): Promise<string> {
    const result = await pool.query<{ id: string }>(
      `INSERT INTO users (email, timezone, reminder_emails_enabled) VALUES ($1, 'Asia/Kolkata', $2) RETURNING id`,
      [email, reminderEmailsEnabled],
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

  async function insertReminder(params: {
    userId: string;
    applicationId: string;
    type?: string;
    dueAt?: Date;
    status?: string;
    notifiedAt?: Date | null;
    snoozedUntil?: Date | null;
  }): Promise<string> {
    const result = await pool.query<{ id: string }>(
      `INSERT INTO reminders (user_id, application_id, type, due_at, status, notified_at, snoozed_until)
       VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING id`,
      [
        params.userId,
        params.applicationId,
        params.type ?? "application_followup",
        params.dueAt ?? new Date(Date.now() - 60_000),
        params.status ?? "pending",
        params.notifiedAt ?? null,
        params.snoozedUntil ?? null,
      ],
    );
    return result.rows[0].id;
  }

  async function reminderRow(reminderId: string): Promise<{ notified_at: Date | null }> {
    const result = await pool.query<{ notified_at: Date | null }>(
      `SELECT notified_at FROM reminders WHERE id = $1`,
      [reminderId],
    );
    return result.rows[0];
  }

  async function seedSentToday(count: number): Promise<void> {
    for (let i = 0; i < count; i += 1) {
      await pool.query(
        `INSERT INTO email_log (recipient, purpose, sent_at) VALUES ($1, 'password_reset', now())`,
        [`filler-${i}@example.com`],
      );
    }
  }

  async function mailpitMessageCount(): Promise<number> {
    const listResp = await fetch(`${mailpitHttpBase}/api/v1/messages`);
    const list = (await listResp.json()) as { messages: MailpitMessageSummary[] };
    return list.messages.length;
  }

  async function latestMailpitMessage(): Promise<MailpitMessage> {
    const listResp = await fetch(`${mailpitHttpBase}/api/v1/messages`);
    const list = (await listResp.json()) as { messages: MailpitMessageSummary[] };
    const id = list.messages[0].ID;
    const msgResp = await fetch(`${mailpitHttpBase}/api/v1/message/${id}`);
    return (await msgResp.json()) as MailpitMessage;
  }

  it("sends a notification for a due, opted-in reminder and sets notified_at", async () => {
    const userId = await insertUser("due-opted-in@example.com");
    const applicationId = await insertApplication(userId);
    const reminderId = await insertReminder({ userId, applicationId });

    const result = await runNotificationTick();

    expect(result.sent).toBe(1);
    const message = await latestMailpitMessage();
    expect(message.To[0].Address).toBe("due-opted-in@example.com");
    expect(message.Subject).toContain("Acme");

    const reminder = await reminderRow(reminderId);
    expect(reminder.notified_at).not.toBeNull();
  });

  it("skips sending for an opted-out user but still marks notified_at", async () => {
    const userId = await insertUser("opted-out@example.com", false);
    const applicationId = await insertApplication(userId);
    const reminderId = await insertReminder({ userId, applicationId });

    const result = await runNotificationTick();

    expect(result.sent).toBe(0);
    expect(result.optedOut).toBe(1);
    expect(await mailpitMessageCount()).toBe(0);

    const reminder = await reminderRow(reminderId);
    expect(reminder.notified_at).not.toBeNull();
  });

  it("defers sending once the daily send threshold is reached, leaving notified_at null", async () => {
    await seedSentToday(250);
    const userId = await insertUser("deferred@example.com");
    const applicationId = await insertApplication(userId);
    const reminderId = await insertReminder({ userId, applicationId });

    const result = await runNotificationTick();

    expect(result.sent).toBe(0);
    expect(result.deferred).toBe(1);
    expect(await mailpitMessageCount()).toBe(0);

    const reminder = await reminderRow(reminderId);
    expect(reminder.notified_at).toBeNull();
  });

  it("does not touch a reminder that isn't due yet", async () => {
    const userId = await insertUser("not-due@example.com");
    const applicationId = await insertApplication(userId);
    const reminderId = await insertReminder({ userId, applicationId, dueAt: new Date(Date.now() + 60_000) });

    await runNotificationTick();

    expect(await mailpitMessageCount()).toBe(0);
    const reminder = await reminderRow(reminderId);
    expect(reminder.notified_at).toBeNull();
  });

  it("does not touch a dismissed reminder", async () => {
    const userId = await insertUser("dismissed@example.com");
    const applicationId = await insertApplication(userId);
    const dismissedId = await insertReminder({
      userId,
      applicationId,
      type: "post_interview",
      status: "dismissed",
    });

    await runNotificationTick();

    expect(await mailpitMessageCount()).toBe(0);
    expect((await reminderRow(dismissedId)).notified_at).toBeNull();
  });

  it("does not notify an actively-snoozed reminder", async () => {
    const userId = await insertUser("active-snooze@example.com");
    const applicationId = await insertApplication(userId);
    const snoozedId = await insertReminder({
      userId,
      applicationId,
      status: "snoozed",
      snoozedUntil: new Date(Date.now() + 60_000),
    });

    await runNotificationTick();

    expect(await mailpitMessageCount()).toBe(0);
    expect((await reminderRow(snoozedId)).notified_at).toBeNull();
  });

  it("notifies again once an expired snooze has passed", async () => {
    const userId = await insertUser("expired-snooze@example.com");
    const applicationId = await insertApplication(userId);
    const reminderId = await insertReminder({
      userId,
      applicationId,
      status: "snoozed",
      snoozedUntil: new Date(Date.now() - 30_000),
    });

    const result = await runNotificationTick();

    expect(result.sent).toBe(1);
    expect((await reminderRow(reminderId)).notified_at).not.toBeNull();
  });

  it("does not re-send an already-notified reminder on a second tick", async () => {
    const userId = await insertUser("already-notified@example.com");
    const applicationId = await insertApplication(userId);
    await insertReminder({ userId, applicationId, notifiedAt: new Date() });

    const result = await runNotificationTick();

    expect(result.sent).toBe(0);
    expect(await mailpitMessageCount()).toBe(0);
  });

  it("uses distinct copy for R1 and R2", async () => {
    const userId = await insertUser("copy-check@example.com");
    const applicationId = await insertApplication(userId);
    await insertReminder({ userId, applicationId, type: "post_interview" });

    await runNotificationTick();

    const message = await latestMailpitMessage();
    expect(message.Subject).toContain("thank-you");
  });
});

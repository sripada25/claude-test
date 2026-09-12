import { PostgreSqlContainer, type StartedPostgreSqlContainer } from "@testcontainers/postgresql";
import { GenericContainer, type StartedTestContainer, Wait } from "testcontainers";
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";

interface MailpitMessageSummary {
  ID: string;
}

interface MailpitMessage {
  To: { Address: string }[];
  ReplyTo: { Address: string }[];
  Subject: string;
  Text: string;
}

describe("/api/reminders/:id/sent (real Postgres + Mailpit)", () => {
  let pgContainer: StartedPostgreSqlContainer;
  let mailpitContainer: StartedTestContainer;
  let mailpitHttpBase: string;
  let POST_: typeof import("./route.ts")["POST"];
  let migrate: typeof import("../../../../../scripts/migrate.ts");
  let pool: typeof import("../../../../../lib/db.ts")["pool"];

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

    migrate = await import("../../../../../scripts/migrate.ts");
    ({ pool } = await import("../../../../../lib/db.ts"));
    ({ POST: POST_ } = await import("./route.ts"));

    await migrate.up();
  }, 90_000);

  afterEach(async () => {
    await pool.query("DELETE FROM users");
    await pool.query("DELETE FROM email_log");
    await fetch(`${mailpitHttpBase}/api/v1/messages`, { method: "DELETE" });
  });

  afterAll(async () => {
    await pool.end();
    await pgContainer.stop();
    await mailpitContainer.stop();
  });

  async function insertUser(email: string): Promise<string> {
    const result = await pool.query<{ id: string }>(
      "INSERT INTO users (email, timezone) VALUES ($1, 'Asia/Kolkata') RETURNING id",
      [email],
    );
    return result.rows[0].id;
  }

  async function insertSubscription(userId: string, tier: "free" | "pro"): Promise<void> {
    await pool.query(
      `INSERT INTO subscriptions (user_id, status, tier) VALUES ($1, 'active', $2)`,
      [userId, tier],
    );
  }

  async function insertProfile(
    userId: string,
    params: { contactEmail: string | null; verified: boolean },
  ): Promise<void> {
    await pool.query(
      `INSERT INTO profiles (user_id, full_name, contact_email, contact_email_verified_at)
       VALUES ($1, 'Aakriti Kapoor', $2, $3)`,
      [userId, params.contactEmail, params.verified ? new Date() : null],
    );
  }

  async function insertApplication(userId: string, contactEmail: string | null): Promise<string> {
    const result = await pool.query<{ id: string }>(
      `INSERT INTO applications (user_id, company, role, contact_email) VALUES ($1, 'Razorpay', 'Product Designer II', $2) RETURNING id`,
      [userId, contactEmail],
    );
    return result.rows[0].id;
  }

  async function insertReminder(params: {
    userId: string;
    applicationId: string;
    status?: string;
    draftContent?: string | null;
  }): Promise<string> {
    const result = await pool.query<{ id: string }>(
      `INSERT INTO reminders (user_id, application_id, type, due_at, status, draft_content)
       VALUES ($1, $2, 'application_followup', now(), $3, $4) RETURNING id`,
      [params.userId, params.applicationId, params.status ?? "pending", params.draftContent ?? "Hi Priya, following up..."],
    );
    return result.rows[0].id;
  }

  async function messagesTo(email: string): Promise<MailpitMessage[]> {
    const listResp = await fetch(`${mailpitHttpBase}/api/v1/messages`);
    const list = (await listResp.json()) as { messages: MailpitMessageSummary[] };
    const results: MailpitMessage[] = [];
    for (const summary of list.messages) {
      const msgResp = await fetch(`${mailpitHttpBase}/api/v1/message/${summary.ID}`);
      const msg = (await msgResp.json()) as MailpitMessage;
      if (msg.To.some((to) => to.Address === email)) {
        results.push(msg);
      }
    }
    return results;
  }

  function postRequest(userId: string | null, subject: string | null = "Following up"): Request {
    return new Request("http://localhost:3000/api/reminders/any-id/sent", {
      method: "POST",
      headers: {
        ...(userId ? { "x-user-id": userId } : {}),
        "Content-Type": "application/json",
      },
      body: JSON.stringify(subject === null ? {} : { subject }),
    });
  }

  function callRoute(request: Request, reminderId: string) {
    return POST_(request, { params: Promise.resolve({ id: reminderId }) });
  }

  async function fullySetUpProUser(email: string): Promise<{ userId: string; applicationId: string; reminderId: string }> {
    const userId = await insertUser(email);
    await insertSubscription(userId, "pro");
    await insertProfile(userId, { contactEmail: "aakriti@example.com", verified: true });
    const applicationId = await insertApplication(userId, "recruiter@razorpay.com");
    const reminderId = await insertReminder({ userId, applicationId });
    return { userId, applicationId, reminderId };
  }

  it("returns 401 without a session", async () => {
    const response = await callRoute(postRequest(null), "any-id");
    expect(response.status).toBe(401);
  });

  it("returns 400 for a missing subject", async () => {
    const { userId, reminderId } = await fullySetUpProUser("missing-subject@example.com");
    const response = await callRoute(postRequest(userId, null), reminderId);
    expect(response.status).toBe(400);
  });

  it("returns a generic 404 for a nonexistent reminder", async () => {
    const userId = await insertUser("no-reminder@example.com");
    await insertSubscription(userId, "pro");
    await insertProfile(userId, { contactEmail: "aakriti@example.com", verified: true });

    const response = await callRoute(postRequest(userId), "00000000-0000-0000-0000-000000000000");
    expect(response.status).toBe(404);
  });

  it("returns a generic 404 for a reminder belonging to another user", async () => {
    const owner = await fullySetUpProUser("owner@example.com");
    const otherId = await insertUser("other@example.com");
    await insertSubscription(otherId, "pro");
    await insertProfile(otherId, { contactEmail: "other@example.com", verified: true });

    const response = await callRoute(postRequest(otherId), owner.reminderId);
    expect(response.status).toBe(404);
  });

  it("returns a generic 404 for an already-sent reminder", async () => {
    const userId = await insertUser("already-sent@example.com");
    await insertSubscription(userId, "pro");
    await insertProfile(userId, { contactEmail: "aakriti@example.com", verified: true });
    const applicationId = await insertApplication(userId, "recruiter@razorpay.com");
    const reminderId = await insertReminder({ userId, applicationId, status: "sent" });

    const response = await callRoute(postRequest(userId), reminderId);
    expect(response.status).toBe(404);
  });

  it("returns a generic 404 for a dismissed reminder", async () => {
    const userId = await insertUser("dismissed@example.com");
    await insertSubscription(userId, "pro");
    await insertProfile(userId, { contactEmail: "aakriti@example.com", verified: true });
    const applicationId = await insertApplication(userId, "recruiter@razorpay.com");
    const reminderId = await insertReminder({ userId, applicationId, status: "dismissed" });

    const response = await callRoute(postRequest(userId), reminderId);
    expect(response.status).toBe(404);
  });

  it("sends a snoozed reminder too", async () => {
    const userId = await insertUser("snoozed-sent@example.com");
    await insertSubscription(userId, "pro");
    await insertProfile(userId, { contactEmail: "aakriti@example.com", verified: true });
    const applicationId = await insertApplication(userId, "recruiter@razorpay.com");
    const reminderId = await insertReminder({ userId, applicationId, status: "snoozed" });

    const response = await callRoute(postRequest(userId), reminderId);
    expect(response.status).toBe(200);
  });

  it("never writes to applications.follow_up_snoozed_until", async () => {
    const { userId, applicationId, reminderId } = await fullySetUpProUser("no-app-write@example.com");

    await callRoute(postRequest(userId), reminderId);

    const application = await pool.query<{ follow_up_snoozed_until: Date | null }>(
      "SELECT follow_up_snoozed_until FROM applications WHERE id = $1",
      [applicationId],
    );
    expect(application.rows[0].follow_up_snoozed_until).toBeNull();
  });

  it("rejects a free-tier user with 403", async () => {
    const userId = await insertUser("free-tier@example.com");
    await insertSubscription(userId, "free");
    await insertProfile(userId, { contactEmail: "aakriti@example.com", verified: true });
    const applicationId = await insertApplication(userId, "recruiter@razorpay.com");
    const reminderId = await insertReminder({ userId, applicationId });

    const response = await callRoute(postRequest(userId), reminderId);
    expect(response.status).toBe(403);
    expect(await response.json()).toEqual({ success: false, reason: "not_pro" });
  });

  it("rejects when the application has no recipient email", async () => {
    const userId = await insertUser("no-recipient@example.com");
    await insertSubscription(userId, "pro");
    await insertProfile(userId, { contactEmail: "aakriti@example.com", verified: true });
    const applicationId = await insertApplication(userId, null);
    const reminderId = await insertReminder({ userId, applicationId });

    const response = await callRoute(postRequest(userId), reminderId);
    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({ success: false, reason: "no_recipient" });
  });

  it("rejects when the sender's contact email is unverified", async () => {
    const userId = await insertUser("unverified@example.com");
    await insertSubscription(userId, "pro");
    await insertProfile(userId, { contactEmail: "aakriti@example.com", verified: false });
    const applicationId = await insertApplication(userId, "recruiter@razorpay.com");
    const reminderId = await insertReminder({ userId, applicationId });

    const response = await callRoute(postRequest(userId), reminderId);
    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({ success: false, reason: "contact_email_unverified" });
  });

  it("sends the email with the correct Reply-To, marks the reminder sent, and logs it", async () => {
    const { userId, reminderId } = await fullySetUpProUser("full-send@example.com");

    const response = await callRoute(postRequest(userId, "Following up — Product Designer II"), reminderId);
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.status).toBe("sent");
    expect(body.recipientEmail).toBe("recruiter@razorpay.com");

    const messages = await messagesTo("recruiter@razorpay.com");
    expect(messages).toHaveLength(1);
    expect(messages[0].Subject).toBe("Following up — Product Designer II");
    expect(messages[0].ReplyTo).toEqual([{ Name: "", Address: "aakriti@example.com" }]);

    const reminder = await pool.query<{ status: string; sent_at: Date | null }>(
      "SELECT status, sent_at FROM reminders WHERE id = $1",
      [reminderId],
    );
    expect(reminder.rows[0].status).toBe("sent");
    expect(reminder.rows[0].sent_at).not.toBeNull();

    const events = await pool.query<{ type: string }>(
      "SELECT type FROM application_events WHERE application_id = (SELECT application_id FROM reminders WHERE id = $1)",
      [reminderId],
    );
    expect(events.rows).toEqual([{ type: "follow_up_sent" }]);

    const log = await pool.query<{ purpose: string; sent_at: Date | null }>(
      "SELECT purpose, sent_at FROM email_log WHERE recipient = 'recruiter@razorpay.com'",
    );
    expect(log.rows).toEqual([{ purpose: "follow_up_manual_send", sent_at: expect.any(Date) }]);
  });

  it("an embedded newline in the subject does not corrupt the outgoing message", async () => {
    const { userId, reminderId } = await fullySetUpProUser("header-injection@example.com");

    const response = await callRoute(
      postRequest(userId, "Following up\r\nBcc: attacker@evil.com"),
      reminderId,
    );

    expect(response.status).toBe(200);
    const messages = await messagesTo("recruiter@razorpay.com");
    expect(messages).toHaveLength(1);
    expect(messages[0].To).toEqual([{ Name: "", Address: "recruiter@razorpay.com" }]);
  });

  it("leaves the reminder unresolved and logs a failure when the send fails", async () => {
    const { userId, reminderId } = await fullySetUpProUser("send-failure@example.com");

    const originalHost = process.env.SMTP_HOST;
    process.env.SMTP_HOST = "127.0.0.1";
    process.env.SMTP_PORT = "1";
    try {
      const response = await callRoute(postRequest(userId), reminderId);
      expect(response.status).toBe(502);
      expect(await response.json()).toEqual({ success: false, reason: "send_failed" });
    } finally {
      process.env.SMTP_HOST = originalHost;
      process.env.SMTP_PORT = String(mailpitContainer.getMappedPort(1025));
    }

    const reminder = await pool.query<{ status: string }>("SELECT status FROM reminders WHERE id = $1", [
      reminderId,
    ]);
    expect(reminder.rows[0].status).toBe("pending");

    const log = await pool.query<{ purpose: string; failed_at: Date | null }>(
      "SELECT purpose, failed_at FROM email_log WHERE recipient = 'recruiter@razorpay.com'",
    );
    expect(log.rows).toEqual([{ purpose: "follow_up_manual_send", failed_at: expect.any(Date) }]);
  });

  it("blocks a send once the shared daily quota is spent", async () => {
    const { userId, reminderId } = await fullySetUpProUser("quota@example.com");
    await pool.query(
      `INSERT INTO email_log (recipient, purpose, sent_at) SELECT 'quota-filler@example.com', 'reminder_due', now() FROM generate_series(1, 250)`,
    );

    const response = await callRoute(postRequest(userId), reminderId);

    expect(response.status).toBe(503);
    expect(await response.json()).toEqual({ success: false, reason: "quota_exceeded" });

    const reminder = await pool.query<{ status: string }>("SELECT status FROM reminders WHERE id = $1", [
      reminderId,
    ]);
    expect(reminder.rows[0].status).toBe("pending");
  });
});

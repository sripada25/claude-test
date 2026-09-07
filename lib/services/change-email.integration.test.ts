import { PostgreSqlContainer, type StartedPostgreSqlContainer } from "@testcontainers/postgresql";
import { GenericContainer, type StartedTestContainer, Wait } from "testcontainers";
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";

interface MailpitMessageSummary {
  ID: string;
}

interface MailpitMessage {
  To: { Address: string }[];
  Subject: string;
  Text: string;
}

describe("change-email service (real Postgres + Mailpit)", () => {
  let pgContainer: StartedPostgreSqlContainer;
  let mailpitContainer: StartedTestContainer;
  let mailpitHttpBase: string;
  let changeEmail: typeof import("./change-email.ts");
  let migrate: typeof import("../../scripts/migrate.ts");
  let pool: typeof import("../db.ts")["pool"];

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
    changeEmail = await import("./change-email.ts");

    await migrate.up();
  }, 90_000);

  afterEach(async () => {
    await pool.query(
      "TRUNCATE users, verification_tokens, email_log, auth_attempts, security_events CASCADE",
    );
    await fetch(`${mailpitHttpBase}/api/v1/messages`, { method: "DELETE" });
  });

  afterAll(async () => {
    await pool.end();
    await pgContainer.stop();
    await mailpitContainer.stop();
  });

  async function insertUser(email: string): Promise<string> {
    const result = await pool.query<{ id: string }>(
      "INSERT INTO users (email, timezone) VALUES ($1, $2) RETURNING id",
      [email, "Asia/Kolkata"],
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

  it("sends an OTP to the new address and stores new_email on the token", async () => {
    const userId = await insertUser("old-address@example.com");

    const result = await changeEmail.requestChangeEmail({
      userId,
      newEmail: "new-address@example.com",
    });

    expect(result).toEqual({ success: true });

    const messages = await messagesTo("new-address@example.com");
    expect(messages).toHaveLength(1);
    expect(messages[0].Text).toMatch(/\d{6}/);

    const token = await pool.query<{ new_email: string }>(
      "SELECT new_email FROM verification_tokens WHERE user_id = $1 AND purpose = 'change_email'",
      [userId],
    );
    expect(token.rows).toEqual([{ new_email: "new-address@example.com" }]);
  });

  it("rejects a request for the user's own current email", async () => {
    const userId = await insertUser("same@example.com");

    const result = await changeEmail.requestChangeEmail({ userId, newEmail: "same@example.com" });

    expect(result).toEqual({ success: false, reason: "same_email" });
  });

  it("sends a notice instead when the new email belongs to someone else, changes nothing", async () => {
    const userId = await insertUser("requester@example.com");
    await insertUser("taken@example.com");

    const result = await changeEmail.requestChangeEmail({ userId, newEmail: "taken@example.com" });

    expect(result).toEqual({ success: true });

    const messages = await messagesTo("taken@example.com");
    expect(messages).toHaveLength(1);
    expect(messages[0].Subject).toMatch(/someone tried to change/i);

    const tokens = await pool.query(
      "SELECT 1 FROM verification_tokens WHERE user_id = $1 AND purpose = 'change_email'",
      [userId],
    );
    expect(tokens.rows).toHaveLength(0);
  });

  it("confirm updates users.email and email_verified_at on the correct code", async () => {
    const userId = await insertUser("before-confirm@example.com");
    await changeEmail.requestChangeEmail({ userId, newEmail: "after-confirm@example.com" });

    const messages = await messagesTo("after-confirm@example.com");
    const code = messages[0].Text.match(/\d{6}/)![0];

    const result = await changeEmail.confirmChangeEmail(userId, code);
    expect(result).toEqual({ success: true });

    const user = await pool.query<{ email: string; email_verified_at: Date | null }>(
      "SELECT email, email_verified_at FROM users WHERE id = $1",
      [userId],
    );
    expect(user.rows[0].email).toBe("after-confirm@example.com");
    expect(user.rows[0].email_verified_at).not.toBeNull();
  });

  it("records an email_changed security event on successful confirm", async () => {
    const userId = await insertUser("before-event@example.com");
    await changeEmail.requestChangeEmail({ userId, newEmail: "after-event@example.com" });

    const messages = await messagesTo("after-event@example.com");
    const code = messages[0].Text.match(/\d{6}/)![0];

    await changeEmail.confirmChangeEmail(userId, code);

    const events = await pool.query<{
      event_type: string;
      user_id: string | null;
      metadata: { newEmail?: string };
    }>("SELECT event_type, user_id, metadata FROM security_events WHERE event_type = 'email_changed'");

    expect(events.rows).toEqual([
      {
        event_type: "email_changed",
        user_id: userId,
        metadata: { newEmail: "after-event@example.com" },
      },
    ]);
  });

  it("confirm with the wrong code does not change the email", async () => {
    const userId = await insertUser("wrong-confirm@example.com");
    await changeEmail.requestChangeEmail({ userId, newEmail: "should-not-apply@example.com" });

    const result = await changeEmail.confirmChangeEmail(userId, "000000");
    expect(result).toEqual({ success: false, reason: "incorrect", attemptsRemaining: 4 });

    const user = await pool.query<{ email: string }>("SELECT email FROM users WHERE id = $1", [
      userId,
    ]);
    expect(user.rows[0].email).toBe("wrong-confirm@example.com");
  });

  it("rate limits repeated requests targeting the same new email", async () => {
    const requesterA = await insertUser("requester-a@example.com");
    const requesterB = await insertUser("requester-b@example.com");
    await insertUser("popular-target@example.com");

    // First 5 attempts against the (already-taken) target all still succeed
    // externally (each just records a failure and sends the notice).
    for (let i = 0; i < 5; i++) {
      const result = await changeEmail.requestChangeEmail({
        userId: i % 2 === 0 ? requesterA : requesterB,
        newEmail: "popular-target@example.com",
      });
      expect(result).toEqual({ success: true });
    }

    const limited = await changeEmail.requestChangeEmail({
      userId: requesterA,
      newEmail: "popular-target@example.com",
    });
    expect(limited).toEqual({ success: false, reason: "rate_limited" });
  });
});

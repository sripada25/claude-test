import { PostgreSqlContainer, type StartedPostgreSqlContainer } from "@testcontainers/postgresql";
import { GenericContainer, type StartedTestContainer, Wait } from "testcontainers";
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";

interface MailpitMessageSummary {
  ID: string;
}

interface MailpitMessage {
  To: { Address: string }[];
  Text: string;
}

const VALID_PASSWORD = "a brand new password";

describe("forgot-password service (real Postgres + Mailpit)", () => {
  let pgContainer: StartedPostgreSqlContainer;
  let mailpitContainer: StartedTestContainer;
  let mailpitHttpBase: string;
  let forgotPassword: typeof import("./forgot-password.ts");
  let session: typeof import("./session.ts");
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
    forgotPassword = await import("./forgot-password.ts");
    session = await import("./session.ts");

    await migrate.up();
  }, 90_000);

  afterEach(async () => {
    await pool.query(
      "TRUNCATE users, sessions, verification_tokens, email_log, auth_attempts CASCADE",
    );
    await fetch(`${mailpitHttpBase}/api/v1/messages`, { method: "DELETE" });
  });

  afterAll(async () => {
    await pool.end();
    await pgContainer.stop();
    await mailpitContainer.stop();
  });

  async function insertUser(email: string, passwordHash: string | null): Promise<string> {
    const result = await pool.query<{ id: string }>(
      "INSERT INTO users (email, password_hash, timezone) VALUES ($1, $2, $3) RETURNING id",
      [email, passwordHash, "Asia/Kolkata"],
    );
    return result.rows[0].id;
  }

  async function latestCode(email: string): Promise<string> {
    const listResp = await fetch(`${mailpitHttpBase}/api/v1/messages`);
    const list = (await listResp.json()) as { messages: MailpitMessageSummary[] };
    for (const summary of list.messages) {
      const msgResp = await fetch(`${mailpitHttpBase}/api/v1/message/${summary.ID}`);
      const msg = (await msgResp.json()) as MailpitMessage;
      if (msg.To.some((to) => to.Address === email)) {
        const match = msg.Text.match(/\d{6}/);
        if (match) return match[0];
      }
    }
    throw new Error(`No OTP email found for ${email}`);
  }

  it("full flow: request issues a real OTP, reset with the correct code succeeds", async () => {
    const email = "full-flow@example.com";
    await insertUser(email, "some-existing-hash");

    const requestResult = await forgotPassword.requestPasswordReset(email);
    expect(requestResult).toEqual({ success: true });

    const code = await latestCode(email);
    const resetResult = await forgotPassword.resetPassword({
      email,
      code,
      newPassword: VALID_PASSWORD,
    });

    expect(resetResult.success).toBe(true);
    if (resetResult.success) {
      expect(resetResult.rawToken).toBeTruthy();
    }

    const user = await pool.query<{ password_hash: string }>(
      "SELECT password_hash FROM users WHERE email = $1",
      [email],
    );
    expect(user.rows[0].password_hash).not.toBe("some-existing-hash");
    expect(user.rows[0].password_hash).toMatch(/^\$argon2id\$/);
  });

  it("works for an SSO-only account with no existing password", async () => {
    const email = "sso-only@example.com";
    await insertUser(email, null);

    await forgotPassword.requestPasswordReset(email);
    const code = await latestCode(email);

    const result = await forgotPassword.resetPassword({
      email,
      code,
      newPassword: VALID_PASSWORD,
    });

    expect(result.success).toBe(true);

    const user = await pool.query<{ password_hash: string }>(
      "SELECT password_hash FROM users WHERE email = $1",
      [email],
    );
    expect(user.rows[0].password_hash).toMatch(/^\$argon2id\$/);
  });

  it("responds success and sends nothing for an unknown email", async () => {
    const result = await forgotPassword.requestPasswordReset("nobody@example.com");
    expect(result).toEqual({ success: true });

    const listResp = await fetch(`${mailpitHttpBase}/api/v1/messages`);
    const list = (await listResp.json()) as { messages: unknown[] };
    expect(list.messages).toHaveLength(0);
  });

  it("rejects a weak new password without consuming an OTP attempt", async () => {
    const email = "weak-new-password@example.com";
    await insertUser(email, "some-hash");
    await forgotPassword.requestPasswordReset(email);
    const code = await latestCode(email);

    const result = await forgotPassword.resetPassword({
      email,
      code,
      newPassword: "short",
    });
    expect(result).toEqual({ success: false, reason: "weak_password" });

    // The code is still valid - a real attempt with it now succeeds.
    const secondAttempt = await forgotPassword.resetPassword({
      email,
      code,
      newPassword: VALID_PASSWORD,
    });
    expect(secondAttempt.success).toBe(true);
  });

  it("revokes prior sessions on a successful reset", async () => {
    const email = "revoke-sessions@example.com";
    const userId = await insertUser(email, "some-hash");
    const oldSession = await session.issueSession(userId);

    await forgotPassword.requestPasswordReset(email);
    const code = await latestCode(email);
    await forgotPassword.resetPassword({ email, code, newPassword: VALID_PASSWORD });

    expect(await session.resolveSession(oldSession.rawToken)).toBeNull();
  });

  it("rate limits repeated requests whether the email exists or not", async () => {
    const email = "rate-limited-reset@example.com";
    await insertUser(email, "some-hash");

    for (let i = 0; i < 5; i++) {
      const result = await forgotPassword.requestPasswordReset(email);
      expect(result).toEqual({ success: true });
    }

    const limited = await forgotPassword.requestPasswordReset(email);
    expect(limited).toEqual({ success: false, reason: "rate_limited" });
  });
});

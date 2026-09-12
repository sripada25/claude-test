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

describe("/api/profile/contact-email/verify/confirm (real Postgres + Mailpit)", () => {
  let pgContainer: StartedPostgreSqlContainer;
  let mailpitContainer: StartedTestContainer;
  let mailpitHttpBase: string;
  let issuePOST: typeof import("../route.ts")["POST"];
  let confirmPOST: typeof import("./route.ts")["POST"];
  let migrate: typeof import("../../../../../../scripts/migrate.ts");
  let pool: typeof import("../../../../../../lib/db.ts")["pool"];

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

    migrate = await import("../../../../../../scripts/migrate.ts");
    ({ pool } = await import("../../../../../../lib/db.ts"));
    ({ POST: issuePOST } = await import("../route.ts"));
    ({ POST: confirmPOST } = await import("./route.ts"));

    await migrate.up();
  }, 90_000);

  afterEach(async () => {
    await pool.query("DELETE FROM users");
    await fetch(`${mailpitHttpBase}/api/v1/messages`, { method: "DELETE" });
  });

  afterAll(async () => {
    await pool.end();
    await pgContainer.stop();
    await mailpitContainer.stop();
  });

  async function insertUserWithProfile(email: string, contactEmail: string): Promise<string> {
    const userResult = await pool.query<{ id: string }>(
      "INSERT INTO users (email, timezone) VALUES ($1, 'Asia/Kolkata') RETURNING id",
      [email],
    );
    const userId = userResult.rows[0].id;
    await pool.query("INSERT INTO profiles (user_id, full_name, contact_email) VALUES ($1, $2, $3)", [
      userId,
      "Aakriti Kapoor",
      contactEmail,
    ]);
    return userId;
  }

  async function issuedCode(contactEmail: string): Promise<string> {
    const listResp = await fetch(`${mailpitHttpBase}/api/v1/messages`);
    const list = (await listResp.json()) as { messages: MailpitMessageSummary[] };
    for (const summary of list.messages) {
      const msgResp = await fetch(`${mailpitHttpBase}/api/v1/message/${summary.ID}`);
      const msg = (await msgResp.json()) as MailpitMessage;
      if (msg.To.some((to) => to.Address === contactEmail)) {
        return msg.Text.match(/\d{6}/)![0];
      }
    }
    throw new Error(`no OTP email found for ${contactEmail}`);
  }

  function issueRequest(userId: string): Request {
    return new Request("http://localhost:3000/api/profile/contact-email/verify", {
      method: "POST",
      headers: { "x-user-id": userId },
    });
  }

  function confirmRequest(userId: string | null, code: string | null): Request {
    return new Request("http://localhost:3000/api/profile/contact-email/verify/confirm", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(userId ? { "x-user-id": userId } : {}),
      },
      body: JSON.stringify(code === null ? {} : { code }),
    });
  }

  it("returns 401 without a session", async () => {
    const response = await confirmPOST(confirmRequest(null, "123456"));
    expect(response.status).toBe(401);
  });

  it("returns 400 for a missing code", async () => {
    const userId = await insertUserWithProfile("missing-code@example.com", "recruiter@razorpay.com");

    const response = await confirmPOST(confirmRequest(userId, null));
    expect(response.status).toBe(400);
  });

  it("rejects an incorrect code without setting contact_email_verified_at", async () => {
    const userId = await insertUserWithProfile("wrong-code@example.com", "recruiter@razorpay.com");
    await issuePOST(issueRequest(userId));

    const response = await confirmPOST(confirmRequest(userId, "000000"));
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body).toEqual({ success: false, reason: "incorrect", attemptsRemaining: 4 });

    const row = await pool.query<{ contact_email_verified_at: Date | null }>(
      "SELECT contact_email_verified_at FROM profiles WHERE user_id = $1",
      [userId],
    );
    expect(row.rows[0].contact_email_verified_at).toBeNull();
  });

  it("sets contact_email_verified_at on the correct code", async () => {
    const userId = await insertUserWithProfile("correct-code@example.com", "recruiter@razorpay.com");
    await issuePOST(issueRequest(userId));
    const code = await issuedCode("recruiter@razorpay.com");

    const response = await confirmPOST(confirmRequest(userId, code));

    expect(response.status).toBe(200);
    const row = await pool.query<{ contact_email_verified_at: Date | null }>(
      "SELECT contact_email_verified_at FROM profiles WHERE user_id = $1",
      [userId],
    );
    expect(row.rows[0].contact_email_verified_at).not.toBeNull();
  });
});

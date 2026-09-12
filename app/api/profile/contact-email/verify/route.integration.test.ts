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

describe("/api/profile/contact-email/verify (real Postgres + Mailpit)", () => {
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
    await fetch(`${mailpitHttpBase}/api/v1/messages`, { method: "DELETE" });
  });

  afterAll(async () => {
    await pool.end();
    await pgContainer.stop();
    await mailpitContainer.stop();
  });

  async function insertUserWithProfile(email: string, contactEmail: string | null): Promise<string> {
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

  function postRequest(userId: string | null): Request {
    return new Request("http://localhost:3000/api/profile/contact-email/verify", {
      method: "POST",
      headers: userId ? { "x-user-id": userId } : {},
    });
  }

  it("returns 401 without a session", async () => {
    const response = await POST_(postRequest(null));
    expect(response.status).toBe(401);
  });

  it("returns 400 when the profile has no contact email set", async () => {
    const userId = await insertUserWithProfile("no-contact-email@example.com", null);

    const response = await POST_(postRequest(userId));

    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({ success: false, reason: "no_contact_email" });
  });

  it("sends a 6-digit OTP to the profile's contact email", async () => {
    const userId = await insertUserWithProfile("issue@example.com", "recruiter@razorpay.com");

    const response = await POST_(postRequest(userId));

    expect(response.status).toBe(200);
    const messages = await messagesTo("recruiter@razorpay.com");
    expect(messages).toHaveLength(1);
    expect(messages[0].Text).toMatch(/\d{6}/);
  });

  it("rate limits after 3 sends within the hour", async () => {
    const userId = await insertUserWithProfile("rate-limited@example.com", "recruiter@razorpay.com");

    for (let i = 0; i < 3; i++) {
      const response = await POST_(postRequest(userId));
      expect(response.status).toBe(200);
    }

    const limited = await POST_(postRequest(userId));
    expect(limited.status).toBe(429);
  });
});

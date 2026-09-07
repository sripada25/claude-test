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

const VALID_PASSWORD = "correct horse battery staple";
const VALID_TIMEZONE = "Asia/Kolkata";

describe("signup service (real Postgres + Mailpit)", () => {
  let pgContainer: StartedPostgreSqlContainer;
  let mailpitContainer: StartedTestContainer;
  let mailpitHttpBase: string;
  let signupModule: typeof import("./signup.ts");
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
    signupModule = await import("./signup.ts");

    await migrate.up();
  }, 90_000);

  afterEach(async () => {
    await pool.query(
      "TRUNCATE users, profiles, subscriptions, generation_quota, verification_tokens, email_log, auth_attempts CASCADE",
    );
    await fetch(`${mailpitHttpBase}/api/v1/messages`, { method: "DELETE" });
  });

  afterAll(async () => {
    await pool.end();
    await pgContainer.stop();
    await mailpitContainer.stop();
  });

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

  it("creates all four rows with correct defaults and sends an OTP email for a new address", async () => {
    const email = "new-signup@example.com";

    const result = await signupModule.signup({
      email,
      password: VALID_PASSWORD,
      timezone: VALID_TIMEZONE,
    });

    expect(result).toEqual({ success: true });

    const user = await pool.query<{
      id: string;
      email: string;
      timezone: string;
      password_hash: string;
    }>("SELECT id, email, timezone, password_hash FROM users WHERE email = $1", [email]);
    expect(user.rows).toHaveLength(1);
    expect(user.rows[0].timezone).toBe(VALID_TIMEZONE);
    expect(user.rows[0].password_hash).toMatch(/^\$argon2id\$/);
    const userId = user.rows[0].id;

    const profile = await pool.query<{ full_name: string }>(
      "SELECT full_name FROM profiles WHERE user_id = $1",
      [userId],
    );
    expect(profile.rows).toEqual([{ full_name: "" }]);

    const subscription = await pool.query<{ tier: string; status: string; trial_ends_at: Date }>(
      "SELECT tier, status, trial_ends_at FROM subscriptions WHERE user_id = $1",
      [userId],
    );
    expect(subscription.rows[0].tier).toBe("free");
    expect(subscription.rows[0].status).toBe("trialing");
    const daysUntilTrialEnds =
      (subscription.rows[0].trial_ends_at.getTime() - Date.now()) / (24 * 60 * 60 * 1000);
    expect(daysUntilTrialEnds).toBeGreaterThan(11.9);
    expect(daysUntilTrialEnds).toBeLessThan(12.1);

    const quota = await pool.query<{ used: number }>(
      "SELECT used FROM generation_quota WHERE user_id = $1",
      [userId],
    );
    expect(quota.rows).toEqual([{ used: 0 }]);

    const messages = await messagesTo(email);
    expect(messages).toHaveLength(1);
    expect(messages[0].Text).toMatch(/\d{6}/);
  });

  it("creates nothing and sends a duplicate-notice email for an already-registered address, same response as success", async () => {
    const email = "already-registered@example.com";
    await pool.query("INSERT INTO users (email, timezone) VALUES ($1, $2)", [
      email,
      VALID_TIMEZONE,
    ]);

    const result = await signupModule.signup({
      email,
      password: VALID_PASSWORD,
      timezone: VALID_TIMEZONE,
    });

    expect(result).toEqual({ success: true });

    const users = await pool.query("SELECT id FROM users WHERE email = $1", [email]);
    expect(users.rows).toHaveLength(1); // still just the one pre-existing row

    const messages = await messagesTo(email);
    expect(messages).toHaveLength(1);
    expect(messages[0].Subject).toMatch(/someone tried to sign up/i);
  });

  it("rejects a password under 12 characters without creating anything", async () => {
    const email = "weak-password@example.com";

    const result = await signupModule.signup({
      email,
      password: "short1234567".slice(0, 11),
      timezone: VALID_TIMEZONE,
    });

    expect(result).toEqual({ success: false, reason: "weak_password" });
    const users = await pool.query("SELECT id FROM users WHERE email = $1", [email]);
    expect(users.rows).toHaveLength(0);
  });

  it("rejects an invalid timezone", async () => {
    const result = await signupModule.signup({
      email: "bad-timezone@example.com",
      password: VALID_PASSWORD,
      timezone: "Not/A_Real_Zone",
    });

    expect(result).toEqual({ success: false, reason: "invalid_timezone" });
  });

  it("rate limits repeated signups against the same email, whether pre-existing or just created", async () => {
    const email = "rate-limited@example.com";

    // First call creates the account (succeeded=true, doesn't count toward limit).
    await signupModule.signup({ email, password: VALID_PASSWORD, timezone: VALID_TIMEZONE });

    // Subsequent calls all hit the "existing email" branch (succeeded=false).
    // Default limit is 5 failures before checkRateLimit denies the *next*
    // call - these 5 all still pass (each one only records its own failure
    // after already being let through).
    for (let i = 0; i < 5; i++) {
      const result = await signupModule.signup({
        email,
        password: VALID_PASSWORD,
        timezone: VALID_TIMEZONE,
      });
      expect(result).toEqual({ success: true });
    }

    // The next attempt now sees 5 accumulated failures and is denied.
    const limited = await signupModule.signup({
      email,
      password: VALID_PASSWORD,
      timezone: VALID_TIMEZONE,
    });
    expect(limited).toEqual({ success: false, reason: "rate_limited" });
  });
});

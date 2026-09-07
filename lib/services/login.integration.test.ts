import { PostgreSqlContainer, type StartedPostgreSqlContainer } from "@testcontainers/postgresql";
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";

describe("login service (real Postgres)", () => {
  let container: StartedPostgreSqlContainer;
  let loginModule: typeof import("./login.ts");
  let hashPassword: typeof import("../security/password.ts")["hashPassword"];
  let migrate: typeof import("../../scripts/migrate.ts");
  let pool: typeof import("../db.ts")["pool"];

  beforeAll(async () => {
    container = await new PostgreSqlContainer("postgres:16-alpine").start();
    process.env.DATABASE_URL = container.getConnectionUri();

    migrate = await import("../../scripts/migrate.ts");
    ({ pool } = await import("../db.ts"));
    loginModule = await import("./login.ts");
    ({ hashPassword } = await import("../security/password.ts"));

    await migrate.up();
  }, 60_000);

  afterEach(async () => {
    await pool.query(
      "TRUNCATE users, sessions, auth_attempts, security_events CASCADE",
    );
  });

  afterAll(async () => {
    await pool.end();
    await container.stop();
  });

  async function insertUser(email: string, passwordHash: string | null): Promise<string> {
    const result = await pool.query<{ id: string }>(
      "INSERT INTO users (email, password_hash, timezone) VALUES ($1, $2, $3) RETURNING id",
      [email, passwordHash, "Asia/Kolkata"],
    );
    return result.rows[0].id;
  }

  it("succeeds with correct credentials and issues a session", async () => {
    const passwordHash = await hashPassword("correct horse battery staple");
    await insertUser("real-user@example.com", passwordHash);

    const result = await loginModule.login({
      email: "real-user@example.com",
      password: "correct horse battery staple",
    });

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.rawToken).toBeTruthy();
    }
  });

  it("gives identical responses for unknown email, wrong password, and an SSO-only account", async () => {
    const passwordHash = await hashPassword("the real password");
    await insertUser("has-password@example.com", passwordHash);
    await insertUser("sso-only@example.com", null);

    const unknownResult = await loginModule.login({
      email: "nobody@example.com",
      password: "whatever password",
    });
    const wrongPasswordResult = await loginModule.login({
      email: "has-password@example.com",
      password: "wrong password",
    });
    const ssoOnlyResult = await loginModule.login({
      email: "sso-only@example.com",
      password: "any password at all",
    });

    expect(unknownResult).toEqual({ success: false, reason: "invalid_credentials" });
    expect(wrongPasswordResult).toEqual({ success: false, reason: "invalid_credentials" });
    expect(ssoOnlyResult).toEqual({ success: false, reason: "invalid_credentials" });
  });

  it("records attempts in auth_attempts for both success and failure", async () => {
    const passwordHash = await hashPassword("correct horse battery staple");
    await insertUser("attempt-tracking@example.com", passwordHash);

    await loginModule.login({
      email: "attempt-tracking@example.com",
      password: "wrong",
    });
    await loginModule.login({
      email: "attempt-tracking@example.com",
      password: "correct horse battery staple",
    });

    const attempts = await pool.query<{ succeeded: boolean }>(
      "SELECT succeeded FROM auth_attempts WHERE identifier = $1 ORDER BY created_at",
      ["attempt-tracking@example.com"],
    );
    expect(attempts.rows).toEqual([{ succeeded: false }, { succeeded: true }]);
  });

  it("rate limits repeated failures against the same email", async () => {
    const email = "rate-limited-login@example.com";
    const passwordHash = await hashPassword("correct horse battery staple");
    await insertUser(email, passwordHash);

    for (let i = 0; i < 5; i++) {
      const result = await loginModule.login({ email, password: "wrong" });
      expect(result).toEqual({ success: false, reason: "invalid_credentials" });
    }

    const limited = await loginModule.login({ email, password: "wrong" });
    expect(limited).toEqual({ success: false, reason: "rate_limited" });
  });

  it("records login_success and login_failed security events", async () => {
    const passwordHash = await hashPassword("correct horse battery staple");
    const userId = await insertUser("events@example.com", passwordHash);

    await loginModule.login({ email: "events@example.com", password: "wrong" });
    await loginModule.login({
      email: "events@example.com",
      password: "correct horse battery staple",
    });

    const events = await pool.query<{ event_type: string; user_id: string | null }>(
      "SELECT event_type, user_id FROM security_events ORDER BY created_at",
    );
    expect(events.rows).toEqual([
      { event_type: "login_failed", user_id: null },
      { event_type: "login_success", user_id: userId },
    ]);
  });
});

import { PostgreSqlContainer, type StartedPostgreSqlContainer } from "@testcontainers/postgresql";
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";

const CURRENT_PASSWORD = "the current password";
const NEW_PASSWORD = "a brand new password";

describe("/api/auth/change-password (real Postgres)", () => {
  let container: StartedPostgreSqlContainer;
  let POST_: typeof import("./route.ts")["POST"];
  let hashPassword: typeof import("../../../../lib/security/password.ts")["hashPassword"];
  let verifyPassword: typeof import("../../../../lib/security/password.ts")["verifyPassword"];
  let issueSession: typeof import("../../../../lib/services/session.ts")["issueSession"];
  let resolveSession: typeof import("../../../../lib/services/session.ts")["resolveSession"];
  let migrate: typeof import("../../../../scripts/migrate.ts");
  let pool: typeof import("../../../../lib/db.ts")["pool"];

  beforeAll(async () => {
    container = await new PostgreSqlContainer("postgres:16-alpine").start();
    process.env.DATABASE_URL = container.getConnectionUri();

    migrate = await import("../../../../scripts/migrate.ts");
    ({ pool } = await import("../../../../lib/db.ts"));
    ({ POST: POST_ } = await import("./route.ts"));
    ({ hashPassword, verifyPassword } = await import("../../../../lib/security/password.ts"));
    ({ issueSession, resolveSession } = await import("../../../../lib/services/session.ts"));

    await migrate.up();
  }, 60_000);

  afterEach(async () => {
    await pool.query("TRUNCATE users, sessions, auth_attempts, security_events CASCADE");
  });

  afterAll(async () => {
    await pool.end();
    await container.stop();
  });

  async function insertUserWithPassword(email: string): Promise<string> {
    const hash = await hashPassword(CURRENT_PASSWORD);
    const result = await pool.query<{ id: string }>(
      "INSERT INTO users (email, timezone, password_hash) VALUES ($1, $2, $3) RETURNING id",
      [email, "Asia/Kolkata", hash],
    );
    return result.rows[0].id;
  }

  async function insertOauthOnlyUser(email: string): Promise<string> {
    const result = await pool.query<{ id: string }>(
      "INSERT INTO users (email, timezone) VALUES ($1, $2) RETURNING id",
      [email, "Asia/Kolkata"],
    );
    return result.rows[0].id;
  }

  async function storedHash(userId: string): Promise<string> {
    const result = await pool.query<{ password_hash: string }>(
      "SELECT password_hash FROM users WHERE id = $1",
      [userId],
    );
    return result.rows[0].password_hash;
  }

  function request(userId: string | null, body: unknown): Request {
    return new Request("http://localhost:3000/api/auth/change-password", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(userId ? { "x-user-id": userId } : {}),
      },
      body: JSON.stringify(body),
    });
  }

  it("returns 401 without a session", async () => {
    const response = await POST_(request(null, { currentPassword: CURRENT_PASSWORD, newPassword: NEW_PASSWORD }));
    expect(response.status).toBe(401);
  });

  it("changes the password when the current password is correct", async () => {
    const userId = await insertUserWithPassword("correct-current@example.com");

    const response = await POST_(
      request(userId, { currentPassword: CURRENT_PASSWORD, newPassword: NEW_PASSWORD }),
    );

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ success: true });

    const hash = await storedHash(userId);
    expect(await verifyPassword(hash, NEW_PASSWORD)).toBe(true);
    expect(await verifyPassword(hash, CURRENT_PASSWORD)).toBe(false);
  });

  it("rejects an incorrect current password and changes nothing", async () => {
    const userId = await insertUserWithPassword("wrong-current@example.com");

    const response = await POST_(
      request(userId, { currentPassword: "not the right password", newPassword: NEW_PASSWORD }),
    );

    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({ success: false, reason: "incorrect_current_password" });

    const hash = await storedHash(userId);
    expect(await verifyPassword(hash, CURRENT_PASSWORD)).toBe(true);
  });

  it("rejects a missing current password for an account that has one", async () => {
    const userId = await insertUserWithPassword("missing-current@example.com");

    const response = await POST_(request(userId, { newPassword: NEW_PASSWORD }));

    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({ success: false, reason: "incorrect_current_password" });
  });

  it("sets a password for an OAuth-only account with no currentPassword required", async () => {
    const userId = await insertOauthOnlyUser("oauth-only@example.com");

    const response = await POST_(request(userId, { newPassword: NEW_PASSWORD }));

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ success: true });

    const hash = await storedHash(userId);
    expect(await verifyPassword(hash, NEW_PASSWORD)).toBe(true);
  });

  it("rejects a new password under 12 characters", async () => {
    const userId = await insertUserWithPassword("weak-password@example.com");

    const response = await POST_(request(userId, { currentPassword: CURRENT_PASSWORD, newPassword: "short" }));

    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({ success: false, reason: "weak_password" });
  });

  it("rate limits after repeated wrong attempts", async () => {
    const userId = await insertUserWithPassword("rate-limited@example.com");

    for (let i = 0; i < 5; i++) {
      const response = await POST_(
        request(userId, { currentPassword: "still wrong", newPassword: NEW_PASSWORD }),
      );
      expect(response.status).toBe(400);
    }

    const limited = await POST_(
      request(userId, { currentPassword: CURRENT_PASSWORD, newPassword: NEW_PASSWORD }),
    );
    expect(limited.status).toBe(429);
    expect(await limited.json()).toEqual({ success: false, reason: "rate_limited" });
  });

  it("revokes all sessions, including the caller's own, on success", async () => {
    const userId = await insertUserWithPassword("revoke-sessions@example.com");
    const { rawToken } = await issueSession(userId);
    expect(await resolveSession(rawToken)).not.toBeNull();

    await POST_(request(userId, { currentPassword: CURRENT_PASSWORD, newPassword: NEW_PASSWORD }));

    expect(await resolveSession(rawToken)).toBeNull();
  });

  it("logs a password_changed security event on success", async () => {
    const userId = await insertUserWithPassword("security-event@example.com");

    await POST_(request(userId, { currentPassword: CURRENT_PASSWORD, newPassword: NEW_PASSWORD }));

    const events = await pool.query<{ event_type: string }>(
      "SELECT event_type FROM security_events WHERE user_id = $1",
      [userId],
    );
    expect(events.rows).toEqual([{ event_type: "password_changed" }]);
  });
});

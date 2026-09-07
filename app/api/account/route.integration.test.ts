import { PostgreSqlContainer, type StartedPostgreSqlContainer } from "@testcontainers/postgresql";
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";

describe("DELETE /api/account (real Postgres)", () => {
  let container: StartedPostgreSqlContainer;
  let DELETE_: typeof import("./route.ts")["DELETE"];
  let migrate: typeof import("../../../scripts/migrate.ts");
  let pool: typeof import("../../../lib/db.ts")["pool"];

  beforeAll(async () => {
    container = await new PostgreSqlContainer("postgres:16-alpine").start();
    process.env.DATABASE_URL = container.getConnectionUri();

    migrate = await import("../../../scripts/migrate.ts");
    ({ pool } = await import("../../../lib/db.ts"));
    ({ DELETE: DELETE_ } = await import("./route.ts"));

    await migrate.up();
  }, 60_000);

  afterEach(async () => {
    await pool.query(
      "TRUNCATE users, email_log, security_events, verification_tokens CASCADE",
    );
  });

  afterAll(async () => {
    await pool.end();
    await container.stop();
  });

  async function insertUserWithRelatedRows(email: string): Promise<string> {
    const userResult = await pool.query<{ id: string }>(
      "INSERT INTO users (email, timezone) VALUES ($1, $2) RETURNING id",
      [email, "Asia/Kolkata"],
    );
    const userId = userResult.rows[0].id;

    await pool.query("INSERT INTO profiles (user_id, full_name) VALUES ($1, '')", [userId]);
    await pool.query(
      "INSERT INTO sessions (user_id, token_hash, expires_at) VALUES ($1, 'hash', now() + interval '1 day')",
      [userId],
    );
    await pool.query("INSERT INTO subscriptions (user_id) VALUES ($1)", [userId]);
    await pool.query(
      "INSERT INTO generation_quota (user_id, period_start) VALUES ($1, '2026-09-01')",
      [userId],
    );
    await pool.query(
      "INSERT INTO oauth_accounts (user_id, provider, provider_user_id) VALUES ($1, 'google', 'sub-123')",
      [userId],
    );
    await pool.query(
      `INSERT INTO verification_tokens (user_id, token_hash, purpose, expires_at)
       VALUES ($1, 'hash', 'verify_email', now() + interval '10 minutes')`,
      [userId],
    );
    const emailLogResult = await pool.query<{ id: string }>(
      "INSERT INTO email_log (user_id, recipient, purpose) VALUES ($1, $2, 'verify_email') RETURNING id",
      [userId, email],
    );
    const securityEventResult = await pool.query<{ id: string }>(
      "INSERT INTO security_events (event_type, user_id) VALUES ('login_success', $1) RETURNING id",
      [userId],
    );

    return JSON.stringify({
      userId,
      emailLogId: emailLogResult.rows[0].id,
      securityEventId: securityEventResult.rows[0].id,
    });
  }

  function requestWithUserId(userId: string | null): Request {
    return new Request("http://localhost:3000/api/account", {
      method: "DELETE",
      headers: userId ? { "x-user-id": userId } : {},
    });
  }

  it("cascades: deletes the user and every currently-existing related row", async () => {
    const { userId, emailLogId, securityEventId } = JSON.parse(
      await insertUserWithRelatedRows("delete-me@example.com"),
    );

    const response = await DELETE_(requestWithUserId(userId));

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ success: true });

    const tables = [
      "users",
      "profiles",
      "sessions",
      "subscriptions",
      "generation_quota",
      "oauth_accounts",
      "verification_tokens",
    ];
    for (const table of tables) {
      const idColumn = table === "users" ? "id" : "user_id";
      const result = await pool.query(`SELECT 1 FROM ${table} WHERE ${idColumn} = $1`, [userId]);
      expect(result.rows).toHaveLength(0);
    }

    const emailLog = await pool.query<{ user_id: string | null }>(
      "SELECT user_id FROM email_log WHERE id = $1",
      [emailLogId],
    );
    expect(emailLog.rows).toEqual([{ user_id: null }]);

    const securityEvent = await pool.query<{ user_id: string | null }>(
      "SELECT user_id FROM security_events WHERE id = $1",
      [securityEventId],
    );
    expect(securityEvent.rows).toEqual([{ user_id: null }]);
  });

  it("clears the session cookie on the response", async () => {
    const { userId } = JSON.parse(await insertUserWithRelatedRows("cookie-check@example.com"));

    const response = await DELETE_(requestWithUserId(userId));

    const cookie = response.cookies.get("session");
    expect(cookie?.value).toBe("");
    expect(cookie?.maxAge).toBe(0);
  });

  it("returns 401 and deletes nothing without the x-user-id header", async () => {
    const { userId } = JSON.parse(await insertUserWithRelatedRows("no-header@example.com"));

    const response = await DELETE_(requestWithUserId(null));

    expect(response.status).toBe(401);
    const result = await pool.query("SELECT 1 FROM users WHERE id = $1", [userId]);
    expect(result.rows).toHaveLength(1);
  });
});

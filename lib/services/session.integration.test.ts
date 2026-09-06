import { createHash } from "node:crypto";
import { PostgreSqlContainer, type StartedPostgreSqlContainer } from "@testcontainers/postgresql";
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";

describe("session service (real Postgres)", () => {
  let container: StartedPostgreSqlContainer;
  let session: typeof import("./session.ts");
  let migrate: typeof import("../../scripts/migrate.ts");
  let pool: typeof import("../db.ts")["pool"];

  beforeAll(async () => {
    container = await new PostgreSqlContainer("postgres:16-alpine").start();
    process.env.DATABASE_URL = container.getConnectionUri();

    migrate = await import("../../scripts/migrate.ts");
    ({ pool } = await import("../db.ts"));
    session = await import("./session.ts");

    await migrate.up();
  }, 60_000);

  afterEach(async () => {
    await pool.query("DELETE FROM sessions");
    await pool.query("DELETE FROM users");
  });

  afterAll(async () => {
    await pool.end();
    await container.stop();
  });

  async function insertUser(email: string): Promise<string> {
    const result = await pool.query<{ id: string }>(
      "INSERT INTO users (email, timezone) VALUES ($1, $2) RETURNING id",
      [email, "Asia/Kolkata"],
    );
    return result.rows[0].id;
  }

  it("issues a session and resolves it back to the same user", async () => {
    const userId = await insertUser("issue-resolve@example.com");

    const { rawToken } = await session.issueSession(userId, { userAgent: "vitest" });
    const resolved = await session.resolveSession(rawToken);

    expect(resolved).not.toBeNull();
    expect(resolved?.userId).toBe(userId);
  });

  it("returns null for a garbage token", async () => {
    const resolved = await session.resolveSession("this-token-does-not-exist");
    expect(resolved).toBeNull();
  });

  it("returns null for an expired session", async () => {
    const userId = await insertUser("expired@example.com");
    const rawToken = "expired-raw-token";
    const tokenHash = createHash("sha256").update(rawToken).digest("hex");

    await pool.query(
      `INSERT INTO sessions (user_id, token_hash, expires_at)
       VALUES ($1, $2, now() - interval '1 hour')`,
      [userId, tokenHash],
    );

    expect(await session.resolveSession(rawToken)).toBeNull();
  });

  it("returns null for a revoked session", async () => {
    const userId = await insertUser("revoked@example.com");
    const { rawToken } = await session.issueSession(userId);

    await session.revokeSession(rawToken);

    expect(await session.resolveSession(rawToken)).toBeNull();
  });

  it("revokeSession is idempotent on an already-revoked or nonexistent token", async () => {
    const userId = await insertUser("idempotent@example.com");
    const { rawToken } = await session.issueSession(userId);

    await session.revokeSession(rawToken);
    await expect(session.revokeSession(rawToken)).resolves.toBeUndefined();
    await expect(session.revokeSession("never-issued-token")).resolves.toBeUndefined();
  });

  it("revokeAllSessions revokes only the target user's sessions", async () => {
    const userId = await insertUser("revoke-all@example.com");
    const otherUserId = await insertUser("other-user@example.com");

    const first = await session.issueSession(userId);
    const second = await session.issueSession(userId);
    const otherSession = await session.issueSession(otherUserId);

    await session.revokeAllSessions(userId);

    expect(await session.resolveSession(first.rawToken)).toBeNull();
    expect(await session.resolveSession(second.rawToken)).toBeNull();
    expect(await session.resolveSession(otherSession.rawToken)).not.toBeNull();
  });

  it("issuing twice for the same user produces two distinct tokens and rows", async () => {
    const userId = await insertUser("distinct-tokens@example.com");

    const first = await session.issueSession(userId);
    const second = await session.issueSession(userId);

    expect(first.rawToken).not.toBe(second.rawToken);

    const rows = await pool.query("SELECT id FROM sessions WHERE user_id = $1", [userId]);
    expect(rows.rows).toHaveLength(2);
  });
});

import { PostgreSqlContainer, type StartedPostgreSqlContainer } from "@testcontainers/postgresql";
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";

describe("oauth-connections service (real Postgres)", () => {
  let container: StartedPostgreSqlContainer;
  let oauthConnections: typeof import("./oauth-connections.ts");
  let migrate: typeof import("../../scripts/migrate.ts");
  let pool: typeof import("../db.ts")["pool"];

  beforeAll(async () => {
    container = await new PostgreSqlContainer("postgres:16-alpine").start();
    process.env.DATABASE_URL = container.getConnectionUri();

    migrate = await import("../../scripts/migrate.ts");
    ({ pool } = await import("../db.ts"));
    oauthConnections = await import("./oauth-connections.ts");

    await migrate.up();
  }, 60_000);

  afterEach(async () => {
    await pool.query("DELETE FROM users");
  });

  afterAll(async () => {
    await pool.end();
    await container.stop();
  });

  async function insertUser(params: { email: string; passwordHash?: string | null }): Promise<string> {
    const result = await pool.query<{ id: string }>(
      "INSERT INTO users (email, password_hash, timezone) VALUES ($1, $2, 'Asia/Kolkata') RETURNING id",
      [params.email, params.passwordHash ?? null],
    );
    return result.rows[0].id;
  }

  async function linkGoogle(userId: string, sub: string): Promise<void> {
    await pool.query(
      "INSERT INTO oauth_accounts (user_id, provider, provider_user_id) VALUES ($1, 'google', $2)",
      [userId, sub],
    );
  }

  it("lists linked connections and whether the user has a password", async () => {
    const userId = await insertUser({ email: "list@example.com", passwordHash: "hash" });
    await linkGoogle(userId, "sub-1");

    const result = await oauthConnections.listConnections(userId);

    expect(result.hasPassword).toBe(true);
    expect(result.connections).toHaveLength(1);
    expect(result.connections[0].provider).toBe("google");
  });

  it("removes a connection when the user has a password", async () => {
    const userId = await insertUser({ email: "with-password@example.com", passwordHash: "hash" });
    await linkGoogle(userId, "sub-2");

    const result = await oauthConnections.removeConnection(userId, "google");

    expect(result).toEqual({ success: true });
    const remaining = await pool.query("SELECT 1 FROM oauth_accounts WHERE user_id = $1", [
      userId,
    ]);
    expect(remaining.rows).toHaveLength(0);
  });

  it("rejects removing the last credential when the user has no password", async () => {
    const userId = await insertUser({ email: "no-password@example.com", passwordHash: null });
    await linkGoogle(userId, "sub-3");

    const result = await oauthConnections.removeConnection(userId, "google");

    expect(result).toEqual({ success: false, reason: "last_credential" });
    const remaining = await pool.query("SELECT 1 FROM oauth_accounts WHERE user_id = $1", [
      userId,
    ]);
    expect(remaining.rows).toHaveLength(1);
  });

  it("returns not_found for a provider not linked to this user", async () => {
    const userId = await insertUser({ email: "unlinked@example.com", passwordHash: "hash" });

    const result = await oauthConnections.removeConnection(userId, "google");

    expect(result).toEqual({ success: false, reason: "not_found" });
  });
});

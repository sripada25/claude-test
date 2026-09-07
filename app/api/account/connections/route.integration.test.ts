import { PostgreSqlContainer, type StartedPostgreSqlContainer } from "@testcontainers/postgresql";
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";

describe("/api/account/connections (real Postgres)", () => {
  let container: StartedPostgreSqlContainer;
  let GET_: typeof import("./route.ts")["GET"];
  let DELETE_: typeof import("./route.ts")["DELETE"];
  let migrate: typeof import("../../../../scripts/migrate.ts");
  let pool: typeof import("../../../../lib/db.ts")["pool"];

  beforeAll(async () => {
    container = await new PostgreSqlContainer("postgres:16-alpine").start();
    process.env.DATABASE_URL = container.getConnectionUri();

    migrate = await import("../../../../scripts/migrate.ts");
    ({ pool } = await import("../../../../lib/db.ts"));
    ({ GET: GET_, DELETE: DELETE_ } = await import("./route.ts"));

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

  function getRequest(userId: string | null): Request {
    return new Request("http://localhost:3000/api/account/connections", {
      headers: userId ? { "x-user-id": userId } : {},
    });
  }

  function deleteRequest(userId: string | null, provider: string | null): Request {
    const url = new URL("http://localhost:3000/api/account/connections");
    if (provider) url.searchParams.set("provider", provider);
    return new Request(url, {
      method: "DELETE",
      headers: userId ? { "x-user-id": userId } : {},
    });
  }

  it("GET returns linked connections and hasPassword", async () => {
    const userId = await insertUser({ email: "get@example.com", passwordHash: "hash" });
    await linkGoogle(userId, "sub-get");

    const response = await GET_(getRequest(userId));

    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.hasPassword).toBe(true);
    expect(body.connections).toHaveLength(1);
  });

  it("GET returns 401 without x-user-id", async () => {
    const response = await GET_(getRequest(null));
    expect(response.status).toBe(401);
  });

  it("DELETE removes a connection when the user has a password", async () => {
    const userId = await insertUser({ email: "delete@example.com", passwordHash: "hash" });
    await linkGoogle(userId, "sub-delete");

    const response = await DELETE_(deleteRequest(userId, "google"));

    expect(response.status).toBe(200);
    const remaining = await pool.query("SELECT 1 FROM oauth_accounts WHERE user_id = $1", [
      userId,
    ]);
    expect(remaining.rows).toHaveLength(0);
  });

  it("DELETE rejects removing the last credential (409), row untouched", async () => {
    const userId = await insertUser({ email: "last-cred@example.com", passwordHash: null });
    await linkGoogle(userId, "sub-last");

    const response = await DELETE_(deleteRequest(userId, "google"));

    expect(response.status).toBe(409);
    const body = await response.json();
    expect(body).toEqual({ success: false, reason: "last_credential" });
    const remaining = await pool.query("SELECT 1 FROM oauth_accounts WHERE user_id = $1", [
      userId,
    ]);
    expect(remaining.rows).toHaveLength(1);
  });

  it("DELETE returns 404 for a provider not linked to this user", async () => {
    const userId = await insertUser({ email: "not-linked@example.com", passwordHash: "hash" });

    const response = await DELETE_(deleteRequest(userId, "google"));

    expect(response.status).toBe(404);
  });

  it("DELETE returns 401 without x-user-id", async () => {
    const response = await DELETE_(deleteRequest(null, "google"));
    expect(response.status).toBe(401);
  });

  it("DELETE returns 400 for an invalid provider", async () => {
    const userId = await insertUser({ email: "invalid-provider@example.com", passwordHash: "hash" });

    const response = await DELETE_(deleteRequest(userId, "not-a-real-provider"));

    expect(response.status).toBe(400);
  });
});

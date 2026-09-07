import { PostgreSqlContainer, type StartedPostgreSqlContainer } from "@testcontainers/postgresql";
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";

describe("POST /api/auth/logout (real Postgres)", () => {
  let container: StartedPostgreSqlContainer;
  let POST: typeof import("./route.ts")["POST"];
  let session: typeof import("../../../../lib/services/session.ts");
  let migrate: typeof import("../../../../scripts/migrate.ts");
  let pool: typeof import("../../../../lib/db.ts")["pool"];

  beforeAll(async () => {
    container = await new PostgreSqlContainer("postgres:16-alpine").start();
    process.env.DATABASE_URL = container.getConnectionUri();

    migrate = await import("../../../../scripts/migrate.ts");
    ({ pool } = await import("../../../../lib/db.ts"));
    session = await import("../../../../lib/services/session.ts");
    ({ POST } = await import("./route.ts"));

    await migrate.up();
  }, 60_000);

  afterEach(async () => {
    await pool.query("TRUNCATE users, sessions CASCADE");
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

  function requestWithCookie(rawToken: string | null): Request {
    return new Request("http://localhost:3000/api/auth/logout", {
      method: "POST",
      headers: rawToken ? { cookie: `session=${rawToken}` } : {},
    });
  }

  it("revokes a real session so it no longer resolves", async () => {
    const userId = await insertUser("logout-user@example.com");
    const { rawToken } = await session.issueSession(userId);

    const response = await POST(requestWithCookie(rawToken));

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ success: true });
    expect(await session.resolveSession(rawToken)).toBeNull();
  });

  it("succeeds even with no session cookie present", async () => {
    const response = await POST(requestWithCookie(null));

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ success: true });
  });

  it("always clears the cookie on the response", async () => {
    const response = await POST(requestWithCookie(null));

    const cookie = response.cookies.get("session");
    expect(cookie?.value).toBe("");
    expect(cookie?.maxAge).toBe(0);
  });
});

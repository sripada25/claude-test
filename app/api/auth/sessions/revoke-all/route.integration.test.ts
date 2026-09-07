import { PostgreSqlContainer, type StartedPostgreSqlContainer } from "@testcontainers/postgresql";
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";

describe("POST /api/auth/sessions/revoke-all (real Postgres)", () => {
  let container: StartedPostgreSqlContainer;
  let POST_: typeof import("./route.ts")["POST"];
  let migrate: typeof import("../../../../../scripts/migrate.ts");
  let pool: typeof import("../../../../../lib/db.ts")["pool"];
  let issueSession: typeof import("../../../../../lib/services/session.ts")["issueSession"];
  let resolveSession: typeof import("../../../../../lib/services/session.ts")["resolveSession"];

  beforeAll(async () => {
    container = await new PostgreSqlContainer("postgres:16-alpine").start();
    process.env.DATABASE_URL = container.getConnectionUri();

    migrate = await import("../../../../../scripts/migrate.ts");
    ({ pool } = await import("../../../../../lib/db.ts"));
    ({ issueSession, resolveSession } = await import("../../../../../lib/services/session.ts"));
    ({ POST: POST_ } = await import("./route.ts"));

    await migrate.up();
  }, 60_000);

  afterEach(async () => {
    await pool.query("TRUNCATE users CASCADE");
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
    return new Request("http://localhost:3000/api/auth/sessions/revoke-all", {
      method: "POST",
      headers: rawToken ? { cookie: `session=${rawToken}` } : {},
    });
  }

  it("revokes every session for the user, verified against real Postgres", async () => {
    const userId = await insertUser("multi-session@example.com");
    const sessionA = await issueSession(userId);
    const sessionB = await issueSession(userId);
    const sessionC = await issueSession(userId);

    const response = await POST_(requestWithCookie(sessionA.rawToken));

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ success: true });

    expect(await resolveSession(sessionA.rawToken)).toBeNull();
    expect(await resolveSession(sessionB.rawToken)).toBeNull();
    expect(await resolveSession(sessionC.rawToken)).toBeNull();
  });

  it("returns 401 and revokes nothing without a session cookie", async () => {
    const userId = await insertUser("no-cookie@example.com");
    const session = await issueSession(userId);

    const response = await POST_(requestWithCookie(null));

    expect(response.status).toBe(401);
    expect(await resolveSession(session.rawToken)).not.toBeNull();
  });

  it("returns 401 for an invalid session cookie", async () => {
    const response = await POST_(requestWithCookie("not-a-real-token"));

    expect(response.status).toBe(401);
  });

  it("clears the session cookie on the response", async () => {
    const userId = await insertUser("cookie-check@example.com");
    const session = await issueSession(userId);

    const response = await POST_(requestWithCookie(session.rawToken));

    const cookie = response.cookies.get("session");
    expect(cookie?.value).toBe("");
    expect(cookie?.maxAge).toBe(0);
  });
});

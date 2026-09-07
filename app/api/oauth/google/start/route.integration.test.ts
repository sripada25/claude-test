import { PostgreSqlContainer, type StartedPostgreSqlContainer } from "@testcontainers/postgresql";
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";

describe("GET /api/oauth/google/start (real Postgres)", () => {
  let container: StartedPostgreSqlContainer;
  let GET_: typeof import("./route.ts")["GET"];
  let migrate: typeof import("../../../../../scripts/migrate.ts");
  let pool: typeof import("../../../../../lib/db.ts")["pool"];

  beforeAll(async () => {
    container = await new PostgreSqlContainer("postgres:16-alpine").start();
    process.env.DATABASE_URL = container.getConnectionUri();
    process.env.GOOGLE_CLIENT_ID = "test-client-id";
    process.env.GOOGLE_CLIENT_SECRET = "test-client-secret";
    process.env.NEXT_PUBLIC_APP_URL = "http://localhost:3000";

    migrate = await import("../../../../../scripts/migrate.ts");
    ({ pool } = await import("../../../../../lib/db.ts"));
    ({ GET: GET_ } = await import("./route.ts"));

    await migrate.up();
  }, 60_000);

  afterEach(async () => {
    await pool.query("DELETE FROM oauth_states");
  });

  afterAll(async () => {
    await pool.end();
    await container.stop();
  });

  it("redirects to Google with the correct authorization params", async () => {
    const response = await GET_(
      new Request("http://localhost:3000/api/oauth/google/start?timezone=Asia/Kolkata"),
    );

    expect(response.status).toBe(307);
    const location = new URL(response.headers.get("location") ?? "");
    expect(location.origin + location.pathname).toBe(
      "https://accounts.google.com/o/oauth2/v2/auth",
    );
    expect(location.searchParams.get("client_id")).toBe("test-client-id");
    expect(location.searchParams.get("redirect_uri")).toBe(
      "http://localhost:3000/api/oauth/google/callback",
    );
    expect(location.searchParams.get("scope")).toBe("openid profile email");
    expect(location.searchParams.get("code_challenge_method")).toBe("S256");
    expect(location.searchParams.get("state")).toBeTruthy();

    const stateRows = await pool.query("SELECT 1 FROM oauth_states");
    expect(stateRows.rows).toHaveLength(1);
  });

  it("sets the oauth_state and oauth_tz cookies", async () => {
    const response = await GET_(
      new Request("http://localhost:3000/api/oauth/google/start?timezone=Asia/Kolkata"),
    );

    const stateCookie = response.cookies.get("oauth_state");
    const tzCookie = response.cookies.get("oauth_tz");
    expect(stateCookie?.value).toBeTruthy();
    expect(tzCookie?.value).toBe("Asia/Kolkata");
  });

  it("falls back to UTC for a missing or invalid timezone", async () => {
    const missing = await GET_(new Request("http://localhost:3000/api/oauth/google/start"));
    expect(missing.cookies.get("oauth_tz")?.value).toBe("UTC");

    const invalid = await GET_(
      new Request("http://localhost:3000/api/oauth/google/start?timezone=Not/AZone"),
    );
    expect(invalid.cookies.get("oauth_tz")?.value).toBe("UTC");
  });
});

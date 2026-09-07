import { PostgreSqlContainer, type StartedPostgreSqlContainer } from "@testcontainers/postgresql";
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from "vitest";

vi.mock("../oauth/google.ts", () => ({
  exchangeGoogleAuthorizationCode: vi.fn(),
}));

describe("completeGoogleSignIn (real Postgres, Google adapter mocked)", () => {
  let container: StartedPostgreSqlContainer;
  let completeGoogleSignIn: typeof import("./oauth-google-signin.ts")["completeGoogleSignIn"];
  let exchangeGoogleAuthorizationCode: ReturnType<typeof vi.fn>;
  let createOauthState: typeof import("./oauth-state.ts")["createOauthState"];
  let migrate: typeof import("../../scripts/migrate.ts");
  let pool: typeof import("../db.ts")["pool"];
  let resolveSession: typeof import("./session.ts")["resolveSession"];

  const REDIRECT_URI = "http://localhost:3000/api/oauth/google/callback";

  beforeAll(async () => {
    container = await new PostgreSqlContainer("postgres:16-alpine").start();
    process.env.DATABASE_URL = container.getConnectionUri();

    migrate = await import("../../scripts/migrate.ts");
    ({ pool } = await import("../db.ts"));
    ({ createOauthState } = await import("./oauth-state.ts"));
    ({ resolveSession } = await import("./session.ts"));
    ({ completeGoogleSignIn } = await import("./oauth-google-signin.ts"));
    ({ exchangeGoogleAuthorizationCode } = (await import("../oauth/google.ts")) as unknown as {
      exchangeGoogleAuthorizationCode: ReturnType<typeof vi.fn>;
    });

    await migrate.up();
  }, 60_000);

  afterEach(async () => {
    vi.mocked(exchangeGoogleAuthorizationCode).mockReset();
    await pool.query("DELETE FROM oauth_states");
    await pool.query("DELETE FROM users");
  });

  afterAll(async () => {
    await pool.end();
    await container.stop();
  });

  async function newState(): Promise<string> {
    const { state } = await createOauthState({ provider: "google" });
    return state;
  }

  async function insertUser(params: {
    email: string;
    passwordHash?: string | null;
    emailVerified?: boolean;
  }): Promise<string> {
    const result = await pool.query<{ id: string }>(
      `INSERT INTO users (email, password_hash, timezone, email_verified_at)
       VALUES ($1, $2, 'Asia/Kolkata', ${params.emailVerified ? "now()" : "NULL"})
       RETURNING id`,
      [params.email, params.passwordHash ?? null],
    );
    return result.rows[0].id;
  }

  it("creates a new user, profile, and oauth_accounts row for a first-time Google sign-in", async () => {
    const state = await newState();
    vi.mocked(exchangeGoogleAuthorizationCode).mockResolvedValue({
      sub: "google-sub-new",
      email: "new-user@example.com",
      emailVerified: true,
      name: "Jane Doe",
    });

    const result = await completeGoogleSignIn({
      queryState: state,
      cookieState: state,
      code: "auth-code",
      timezone: "Asia/Kolkata",
      redirectUri: REDIRECT_URI,
    });

    expect(result.success).toBe(true);
    if (!result.success) throw new Error("expected success");
    expect(await resolveSession(result.rawToken)).not.toBeNull();

    const user = await pool.query<{ id: string; timezone: string }>(
      "SELECT id, timezone FROM users WHERE email = $1",
      ["new-user@example.com"],
    );
    expect(user.rows).toHaveLength(1);
    expect(user.rows[0].timezone).toBe("Asia/Kolkata");

    const profile = await pool.query<{ full_name: string }>(
      "SELECT full_name FROM profiles WHERE user_id = $1",
      [user.rows[0].id],
    );
    expect(profile.rows[0].full_name).toBe("Jane Doe");

    const oauthAccount = await pool.query(
      "SELECT 1 FROM oauth_accounts WHERE provider = 'google' AND provider_user_id = 'google-sub-new'",
    );
    expect(oauthAccount.rows).toHaveLength(1);

    const subscription = await pool.query<{ trial_ends_at: Date }>(
      "SELECT trial_ends_at FROM subscriptions WHERE user_id = $1",
      [user.rows[0].id],
    );
    const daysUntilTrialEnds =
      (subscription.rows[0].trial_ends_at.getTime() - Date.now()) / (24 * 60 * 60 * 1000);
    expect(daysUntilTrialEnds).toBeGreaterThan(11.9);
    expect(daysUntilTrialEnds).toBeLessThan(12.1);
  });

  it("links to an existing verified user without touching their password", async () => {
    const userId = await insertUser({
      email: "verified@example.com",
      passwordHash: "existing-hash",
      emailVerified: true,
    });
    const state = await newState();
    vi.mocked(exchangeGoogleAuthorizationCode).mockResolvedValue({
      sub: "google-sub-verified",
      email: "verified@example.com",
      emailVerified: true,
      name: "Verified User",
    });

    const result = await completeGoogleSignIn({
      queryState: state,
      cookieState: state,
      code: "auth-code",
      timezone: null,
      redirectUri: REDIRECT_URI,
    });

    expect(result.success).toBe(true);

    const row = await pool.query<{ password_hash: string | null }>(
      "SELECT password_hash FROM users WHERE id = $1",
      [userId],
    );
    expect(row.rows[0].password_hash).toBe("existing-hash");

    const oauthAccount = await pool.query(
      "SELECT 1 FROM oauth_accounts WHERE user_id = $1 AND provider = 'google'",
      [userId],
    );
    expect(oauthAccount.rows).toHaveLength(1);
  });

  it("closes pre-registration takeover: nulls an unverified squatted password on link", async () => {
    const userId = await insertUser({
      email: "squatted@example.com",
      passwordHash: "squatter-hash",
      emailVerified: false,
    });
    const state = await newState();
    vi.mocked(exchangeGoogleAuthorizationCode).mockResolvedValue({
      sub: "google-sub-squatted",
      email: "squatted@example.com",
      emailVerified: true,
      name: "Real Owner",
    });

    const result = await completeGoogleSignIn({
      queryState: state,
      cookieState: state,
      code: "auth-code",
      timezone: null,
      redirectUri: REDIRECT_URI,
    });

    expect(result.success).toBe(true);

    const row = await pool.query<{ password_hash: string | null; email_verified_at: Date | null }>(
      "SELECT password_hash, email_verified_at FROM users WHERE id = $1",
      [userId],
    );
    expect(row.rows[0].password_hash).toBeNull();
    expect(row.rows[0].email_verified_at).not.toBeNull();
  });

  it("logs a repeat sign-in into the same user via the existing oauth_accounts row", async () => {
    const firstState = await newState();
    vi.mocked(exchangeGoogleAuthorizationCode).mockResolvedValue({
      sub: "google-sub-repeat",
      email: "repeat@example.com",
      emailVerified: true,
      name: "Repeat User",
    });
    const first = await completeGoogleSignIn({
      queryState: firstState,
      cookieState: firstState,
      code: "auth-code",
      timezone: "UTC",
      redirectUri: REDIRECT_URI,
    });
    expect(first.success).toBe(true);
    if (!first.success) throw new Error("expected success");
    const firstUserId = (await resolveSession(first.rawToken))?.userId;

    const secondState = await newState();
    const second = await completeGoogleSignIn({
      queryState: secondState,
      cookieState: secondState,
      code: "auth-code-2",
      timezone: "UTC",
      redirectUri: REDIRECT_URI,
    });
    expect(second.success).toBe(true);
    if (!second.success) throw new Error("expected success");
    const secondUserId = (await resolveSession(second.rawToken))?.userId;

    expect(secondUserId).toBe(firstUserId);
    const accounts = await pool.query(
      "SELECT 1 FROM oauth_accounts WHERE provider = 'google' AND provider_user_id = 'google-sub-repeat'",
    );
    expect(accounts.rows).toHaveLength(1);
  });

  it("rejects when the query-string state doesn't match the cookie", async () => {
    const state = await newState();

    const result = await completeGoogleSignIn({
      queryState: state,
      cookieState: "a-different-value",
      code: "auth-code",
      timezone: null,
      redirectUri: REDIRECT_URI,
    });

    expect(result).toEqual({ success: false, reason: "state_mismatch" });
    expect(exchangeGoogleAuthorizationCode).not.toHaveBeenCalled();
  });

  it("rejects a replayed (already-consumed) state", async () => {
    const state = await newState();
    vi.mocked(exchangeGoogleAuthorizationCode).mockResolvedValue({
      sub: "google-sub-replay",
      email: "replay@example.com",
      emailVerified: true,
      name: null,
    });

    await completeGoogleSignIn({
      queryState: state,
      cookieState: state,
      code: "auth-code",
      timezone: null,
      redirectUri: REDIRECT_URI,
    });

    const second = await completeGoogleSignIn({
      queryState: state,
      cookieState: state,
      code: "auth-code",
      timezone: null,
      redirectUri: REDIRECT_URI,
    });

    expect(second).toEqual({ success: false, reason: "state_mismatch" });
  });

  it("rejects an unverified Google email and writes nothing", async () => {
    const state = await newState();
    vi.mocked(exchangeGoogleAuthorizationCode).mockResolvedValue({
      sub: "google-sub-unverified",
      email: "unverified@example.com",
      emailVerified: false,
      name: "Unverified",
    });

    const result = await completeGoogleSignIn({
      queryState: state,
      cookieState: state,
      code: "auth-code",
      timezone: null,
      redirectUri: REDIRECT_URI,
    });

    expect(result).toEqual({ success: false, reason: "email_not_verified" });
    const user = await pool.query("SELECT 1 FROM users WHERE email = $1", [
      "unverified@example.com",
    ]);
    expect(user.rows).toHaveLength(0);
  });

  it("rejects when the code exchange itself fails", async () => {
    const state = await newState();
    vi.mocked(exchangeGoogleAuthorizationCode).mockRejectedValue(new Error("boom"));

    const result = await completeGoogleSignIn({
      queryState: state,
      cookieState: state,
      code: "auth-code",
      timezone: null,
      redirectUri: REDIRECT_URI,
    });

    expect(result).toEqual({ success: false, reason: "exchange_failed" });
  });
});

import { createHash } from "node:crypto";
import { PostgreSqlContainer, type StartedPostgreSqlContainer } from "@testcontainers/postgresql";
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";

describe("oauth-state service (real Postgres)", () => {
  let container: StartedPostgreSqlContainer;
  let oauthState: typeof import("./oauth-state.ts");
  let migrate: typeof import("../../scripts/migrate.ts");
  let pool: typeof import("../db.ts")["pool"];

  beforeAll(async () => {
    container = await new PostgreSqlContainer("postgres:16-alpine").start();
    process.env.DATABASE_URL = container.getConnectionUri();

    migrate = await import("../../scripts/migrate.ts");
    ({ pool } = await import("../db.ts"));
    oauthState = await import("./oauth-state.ts");

    await migrate.up();
  }, 60_000);

  afterEach(async () => {
    await pool.query("DELETE FROM oauth_states");
  });

  afterAll(async () => {
    await pool.end();
    await container.stop();
  });

  it("issues a state/PKCE pair and stores only the hashed state", async () => {
    const { state, codeVerifier, codeChallenge } = await oauthState.createOauthState({
      provider: "google",
    });

    expect(state).toBeTruthy();
    expect(codeVerifier).toBeTruthy();
    expect(codeChallenge).toBeTruthy();
    expect(codeChallenge).not.toBe(codeVerifier);

    const stateHash = createHash("sha256").update(state).digest("hex");
    const row = await pool.query<{ state_hash: string; code_verifier: string }>(
      "SELECT state_hash, code_verifier FROM oauth_states WHERE state_hash = $1",
      [stateHash],
    );
    expect(row.rows).toHaveLength(1);
    expect(row.rows[0].code_verifier).toBe(codeVerifier);

    const rawStateRow = await pool.query("SELECT 1 FROM oauth_states WHERE state_hash = $1", [
      state,
    ]);
    expect(rawStateRow.rows).toHaveLength(0);
  });

  it("consumes a valid state and deletes the row", async () => {
    const { state, codeVerifier } = await oauthState.createOauthState({
      provider: "google",
      redirectPath: "/dashboard",
    });

    const result = await oauthState.consumeOauthState(state, "google");

    expect(result).toEqual({ codeVerifier, redirectPath: "/dashboard", userId: null });

    const stateHash = createHash("sha256").update(state).digest("hex");
    const row = await pool.query("SELECT 1 FROM oauth_states WHERE state_hash = $1", [stateHash]);
    expect(row.rows).toHaveLength(0);
  });

  it("rejects a second consume of the same state", async () => {
    const { state } = await oauthState.createOauthState({ provider: "google" });

    await oauthState.consumeOauthState(state, "google");
    const second = await oauthState.consumeOauthState(state, "google");

    expect(second).toBeNull();
  });

  it("rejects an expired state", async () => {
    const state = "expired-state";
    const stateHash = createHash("sha256").update(state).digest("hex");
    await pool.query(
      `INSERT INTO oauth_states (state_hash, provider, code_verifier, expires_at)
       VALUES ($1, 'google', 'verifier', now() - interval '1 minute')`,
      [stateHash],
    );

    expect(await oauthState.consumeOauthState(state, "google")).toBeNull();
  });

  it("rejects a provider mismatch and leaves the row untouched", async () => {
    const { state } = await oauthState.createOauthState({ provider: "google" });

    const result = await oauthState.consumeOauthState(state, "linkedin");

    expect(result).toBeNull();

    const stateHash = createHash("sha256").update(state).digest("hex");
    const row = await pool.query("SELECT 1 FROM oauth_states WHERE state_hash = $1", [stateHash]);
    expect(row.rows).toHaveLength(1);
  });
});

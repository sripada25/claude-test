import { pool } from "../db.ts";

export type OauthProvider = "google" | "linkedin";

export interface OauthState {
  codeVerifier: string;
  redirectPath: string | null;
  userId: string | null;
}

interface OauthStateRow {
  code_verifier: string;
  redirect_path: string | null;
  user_id: string | null;
}

export async function insertOauthState(params: {
  stateHash: string;
  provider: OauthProvider;
  codeVerifier: string;
  redirectPath: string | null;
  userId: string | null;
  expiresAt: Date;
}): Promise<void> {
  await pool.query(
    `INSERT INTO oauth_states (state_hash, provider, code_verifier, redirect_path, user_id, expires_at)
     VALUES ($1, $2, $3, $4, $5, $6)`,
    [
      params.stateHash,
      params.provider,
      params.codeVerifier,
      params.redirectPath,
      params.userId,
      params.expiresAt,
    ],
  );
}

// Delete-on-read: a row consumed once must never be consumable again
// (SECURITY_quarterfinal.md §2 - "delete on consume, not mark").
export async function consumeOauthState(
  stateHash: string,
  provider: OauthProvider,
): Promise<OauthState | null> {
  const result = await pool.query<OauthStateRow>(
    `DELETE FROM oauth_states
     WHERE state_hash = $1 AND provider = $2 AND expires_at > now()
     RETURNING code_verifier, redirect_path, user_id`,
    [stateHash, provider],
  );
  if (!result.rows[0]) {
    return null;
  }
  return {
    codeVerifier: result.rows[0].code_verifier,
    redirectPath: result.rows[0].redirect_path,
    userId: result.rows[0].user_id,
  };
}

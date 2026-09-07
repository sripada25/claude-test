import { pool } from "../db.ts";
import type { OauthProvider } from "./oauth-state.ts";

export async function findOauthAccountByProviderSub(
  provider: OauthProvider,
  providerUserId: string,
): Promise<{ userId: string } | null> {
  const result = await pool.query<{ user_id: string }>(
    `SELECT user_id FROM oauth_accounts WHERE provider = $1 AND provider_user_id = $2`,
    [provider, providerUserId],
  );
  return result.rows[0] ? { userId: result.rows[0].user_id } : null;
}

export async function linkOauthAccount(params: {
  userId: string;
  provider: OauthProvider;
  providerUserId: string;
}): Promise<void> {
  await pool.query(
    `INSERT INTO oauth_accounts (user_id, provider, provider_user_id) VALUES ($1, $2, $3)`,
    [params.userId, params.provider, params.providerUserId],
  );
}

// The pre-registration-takeover close (SECURITY_quarterfinal.md G2, L069): a
// Google-verified sign-in outranks an unverified squatted password, so the
// password is nulled in the same transaction as the link.
export async function linkOauthAndInvalidatePassword(params: {
  userId: string;
  provider: OauthProvider;
  providerUserId: string;
}): Promise<void> {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    await client.query(
      `UPDATE users SET password_hash = NULL, email_verified_at = now() WHERE id = $1`,
      [params.userId],
    );
    await client.query(
      `INSERT INTO oauth_accounts (user_id, provider, provider_user_id) VALUES ($1, $2, $3)`,
      [params.userId, params.provider, params.providerUserId],
    );
    await client.query("COMMIT");
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  } finally {
    client.release();
  }
}

export async function createUserWithOauth(params: {
  email: string;
  timezone: string;
  fullName: string;
  provider: OauthProvider;
  providerUserId: string;
  periodStart: string;
}): Promise<{ userId: string }> {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    const userResult = await client.query<{ id: string }>(
      `INSERT INTO users (email, timezone, email_verified_at) VALUES ($1, $2, now()) RETURNING id`,
      [params.email, params.timezone],
    );
    const userId = userResult.rows[0].id;

    await client.query(`INSERT INTO profiles (user_id, full_name) VALUES ($1, $2)`, [
      userId,
      params.fullName,
    ]);
    await client.query(`INSERT INTO subscriptions (user_id) VALUES ($1)`, [userId]);
    await client.query(`INSERT INTO generation_quota (user_id, period_start) VALUES ($1, $2)`, [
      userId,
      params.periodStart,
    ]);
    await client.query(
      `INSERT INTO oauth_accounts (user_id, provider, provider_user_id) VALUES ($1, $2, $3)`,
      [userId, params.provider, params.providerUserId],
    );

    await client.query("COMMIT");
    return { userId };
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  } finally {
    client.release();
  }
}

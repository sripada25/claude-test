import { pool } from "../db.ts";

export interface VerificationToken {
  id: string;
  userId: string;
  tokenHash: string;
  purpose: string;
  attempts: number;
  expiresAt: Date;
  usedAt: Date | null;
  createdAt: Date;
}

interface VerificationTokenRow {
  id: string;
  user_id: string;
  token_hash: string;
  purpose: string;
  attempts: number;
  expires_at: Date;
  used_at: Date | null;
  created_at: Date;
}

function toToken(row: VerificationTokenRow): VerificationToken {
  return {
    id: row.id,
    userId: row.user_id,
    tokenHash: row.token_hash,
    purpose: row.purpose,
    attempts: row.attempts,
    expiresAt: row.expires_at,
    usedAt: row.used_at,
    createdAt: row.created_at,
  };
}

export async function invalidateActiveTokens(userId: string, purpose: string): Promise<void> {
  await pool.query(
    `UPDATE verification_tokens SET used_at = now()
     WHERE user_id = $1 AND purpose = $2 AND used_at IS NULL`,
    [userId, purpose],
  );
}

export async function insertToken(params: {
  userId: string;
  tokenHash: string;
  purpose: string;
  expiresAt: Date;
}): Promise<VerificationToken> {
  const result = await pool.query<VerificationTokenRow>(
    `INSERT INTO verification_tokens (user_id, token_hash, purpose, expires_at)
     VALUES ($1, $2, $3, $4)
     RETURNING *`,
    [params.userId, params.tokenHash, params.purpose, params.expiresAt],
  );
  return toToken(result.rows[0]);
}

export async function findActiveToken(
  userId: string,
  purpose: string,
): Promise<VerificationToken | null> {
  const result = await pool.query<VerificationTokenRow>(
    `SELECT * FROM verification_tokens WHERE user_id = $1 AND purpose = $2 AND used_at IS NULL`,
    [userId, purpose],
  );
  return result.rows[0] ? toToken(result.rows[0]) : null;
}

export async function incrementAttempts(id: string): Promise<number> {
  const result = await pool.query<{ attempts: number }>(
    `UPDATE verification_tokens SET attempts = attempts + 1 WHERE id = $1 RETURNING attempts`,
    [id],
  );
  return result.rows[0].attempts;
}

export async function markUsed(id: string): Promise<void> {
  await pool.query(`UPDATE verification_tokens SET used_at = now() WHERE id = $1`, [id]);
}

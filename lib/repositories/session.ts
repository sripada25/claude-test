import { pool } from "../db.ts";

export interface Session {
  id: string;
  userId: string;
  tokenHash: string;
  expiresAt: Date;
  revokedAt: Date | null;
  userAgent: string | null;
  ip: string | null;
  createdAt: Date;
}

interface SessionRow {
  id: string;
  user_id: string;
  token_hash: string;
  expires_at: Date;
  revoked_at: Date | null;
  user_agent: string | null;
  ip: string | null;
  created_at: Date;
}

function toSession(row: SessionRow): Session {
  return {
    id: row.id,
    userId: row.user_id,
    tokenHash: row.token_hash,
    expiresAt: row.expires_at,
    revokedAt: row.revoked_at,
    userAgent: row.user_agent,
    ip: row.ip,
    createdAt: row.created_at,
  };
}

export async function insertSession(params: {
  userId: string;
  tokenHash: string;
  expiresAt: Date;
  userAgent: string | null;
  ip: string | null;
}): Promise<Session> {
  const result = await pool.query<SessionRow>(
    `INSERT INTO sessions (user_id, token_hash, expires_at, user_agent, ip)
     VALUES ($1, $2, $3, $4, $5)
     RETURNING *`,
    [params.userId, params.tokenHash, params.expiresAt, params.userAgent, params.ip],
  );
  return toSession(result.rows[0]);
}

export async function findActiveSessionByTokenHash(tokenHash: string): Promise<Session | null> {
  const result = await pool.query<SessionRow>(
    `SELECT * FROM sessions WHERE token_hash = $1 AND revoked_at IS NULL`,
    [tokenHash],
  );
  return result.rows[0] ? toSession(result.rows[0]) : null;
}

export async function revokeSessionByTokenHash(tokenHash: string): Promise<void> {
  await pool.query(
    `UPDATE sessions SET revoked_at = now() WHERE token_hash = $1 AND revoked_at IS NULL`,
    [tokenHash],
  );
}

export async function revokeAllSessionsForUser(userId: string): Promise<void> {
  await pool.query(
    `UPDATE sessions SET revoked_at = now() WHERE user_id = $1 AND revoked_at IS NULL`,
    [userId],
  );
}

import { pool } from "../db.ts";

export interface UserSummary {
  id: string;
  email: string;
  emailVerifiedAt: Date | null;
}

export async function findUserByEmail(email: string): Promise<UserSummary | null> {
  const result = await pool.query<{ id: string; email: string; email_verified_at: Date | null }>(
    `SELECT id, email, email_verified_at FROM users WHERE email = $1`,
    [email],
  );
  if (!result.rows[0]) {
    return null;
  }
  return {
    id: result.rows[0].id,
    email: result.rows[0].email,
    emailVerifiedAt: result.rows[0].email_verified_at,
  };
}

export async function markEmailVerified(userId: string): Promise<void> {
  await pool.query(`UPDATE users SET email_verified_at = now() WHERE id = $1`, [userId]);
}

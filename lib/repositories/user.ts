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

export async function updatePasswordHash(userId: string, passwordHash: string): Promise<void> {
  await pool.query(`UPDATE users SET password_hash = $2 WHERE id = $1`, [userId, passwordHash]);
}

export async function updateEmail(userId: string, newEmail: string): Promise<void> {
  await pool.query(`UPDATE users SET email = $2, email_verified_at = now() WHERE id = $1`, [
    userId,
    newEmail,
  ]);
}

export interface UserForLogin {
  id: string;
  passwordHash: string | null;
}

// Deliberately separate from findUserByEmail, which never returns
// password_hash - this is the one function allowed to read it, so no other
// call site can accidentally receive it.
export async function findUserForLogin(email: string): Promise<UserForLogin | null> {
  const result = await pool.query<{ id: string; password_hash: string | null }>(
    `SELECT id, password_hash FROM users WHERE email = $1`,
    [email],
  );
  if (!result.rows[0]) {
    return null;
  }
  return { id: result.rows[0].id, passwordHash: result.rows[0].password_hash };
}

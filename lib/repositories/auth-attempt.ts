import { pool } from "../db.ts";

export async function countFailedAttempts(identifier: string, sinceMinutesAgo: number): Promise<number> {
  const result = await pool.query<{ count: string }>(
    `SELECT COUNT(*) AS count FROM auth_attempts
     WHERE identifier = $1 AND succeeded = false AND created_at > now() - ($2 || ' minutes')::interval`,
    [identifier, sinceMinutesAgo],
  );
  return parseInt(result.rows[0].count, 10);
}

export async function insertAttempt(identifier: string, succeeded: boolean): Promise<void> {
  await pool.query(
    `INSERT INTO auth_attempts (identifier, succeeded) VALUES ($1, $2)`,
    [identifier, succeeded],
  );
}

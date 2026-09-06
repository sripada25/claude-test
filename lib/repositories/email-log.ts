import { pool } from "../db.ts";

export async function insertEmailLog(params: {
  userId: string | null;
  recipient: string;
  purpose: string;
  sentAt: Date | null;
  failedAt: Date | null;
  error: string | null;
}): Promise<void> {
  await pool.query(
    `INSERT INTO email_log (user_id, recipient, purpose, sent_at, failed_at, error)
     VALUES ($1, $2, $3, $4, $5, $6)`,
    [
      params.userId,
      params.recipient,
      params.purpose,
      params.sentAt,
      params.failedAt,
      params.error,
    ],
  );
}

export async function countRecentSends(
  userId: string,
  purpose: string,
  sinceMinutesAgo: number,
): Promise<number> {
  const result = await pool.query<{ count: string }>(
    `SELECT COUNT(*) AS count FROM email_log
     WHERE user_id = $1 AND purpose = $2 AND sent_at > now() - ($3 || ' minutes')::interval`,
    [userId, purpose, sinceMinutesAgo],
  );
  return parseInt(result.rows[0].count, 10);
}

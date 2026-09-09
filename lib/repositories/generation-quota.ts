import { pool } from "../db.ts";

// No row exists until a generation is actually enqueued (F3, not built yet) -
// that's a real "0 used", not a missing record, so this returns 0 rather
// than null.
export async function findGenerationQuotaUsed(userId: string, periodStart: Date): Promise<number> {
  const result = await pool.query<{ used: number }>(
    `SELECT used FROM generation_quota WHERE user_id = $1 AND period_start = $2`,
    [userId, periodStart],
  );
  return result.rows[0]?.used ?? 0;
}

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

// AI-RULES.md §7's exact statement. No row exists until first use, so the
// row is bootstrapped first (ON CONFLICT DO NOTHING - safe if two concurrent
// first-time callers race to create it); the UPDATE itself is what makes the
// limit check atomic. Returns the new `used` count, or null if the limit was
// already reached (no row matched `used < limit`, so nothing was updated).
export async function consumeFreeQuota(userId: string, periodStart: Date, limit: number): Promise<number | null> {
  await pool.query(
    `INSERT INTO generation_quota (user_id, period_start, used) VALUES ($1, $2, 0)
     ON CONFLICT (user_id, period_start) DO NOTHING`,
    [userId, periodStart],
  );

  const result = await pool.query<{ used: number }>(
    `UPDATE generation_quota SET used = used + 1
     WHERE user_id = $1 AND period_start = $2 AND used < $3
     RETURNING used`,
    [userId, periodStart, limit],
  );

  return result.rows[0]?.used ?? null;
}

// Floored at 0 so a duplicate refund call can't push usage negative.
export async function refundFreeQuota(userId: string, periodStart: Date): Promise<void> {
  await pool.query(
    `UPDATE generation_quota SET used = GREATEST(used - 1, 0) WHERE user_id = $1 AND period_start = $2`,
    [userId, periodStart],
  );
}

import { pool } from "../db.ts";

export interface Subscription {
  tier: "free" | "pro";
  status: "trialing" | "active" | "past_due" | "cancelled";
  trialEndsAt: Date | null;
  trialGenerationsUsed: number;
  trialGenerationsLimit: number;
}

export async function findSubscriptionByUserId(userId: string): Promise<Subscription | null> {
  const result = await pool.query<{
    tier: Subscription["tier"];
    status: Subscription["status"];
    trial_ends_at: Date | null;
    trial_generations_used: number;
    trial_generations_limit: number;
  }>(
    `SELECT tier, status, trial_ends_at, trial_generations_used, trial_generations_limit
     FROM subscriptions WHERE user_id = $1`,
    [userId],
  );
  if (!result.rows[0]) {
    return null;
  }
  return {
    tier: result.rows[0].tier,
    status: result.rows[0].status,
    trialEndsAt: result.rows[0].trial_ends_at,
    trialGenerationsUsed: result.rows[0].trial_generations_used,
    trialGenerationsLimit: result.rows[0].trial_generations_limit,
  };
}

// Same atomic pattern as generation-quota.ts's consumeFreeQuota, against the
// trial counter instead. Returns the new used count, or null if the trial's
// 40-total cap (L111) was already reached.
export async function incrementTrialGenerationsUsed(userId: string, limit: number): Promise<number | null> {
  const result = await pool.query<{ trial_generations_used: number }>(
    `UPDATE subscriptions SET trial_generations_used = trial_generations_used + 1
     WHERE user_id = $1 AND trial_generations_used < $2
     RETURNING trial_generations_used`,
    [userId, limit],
  );
  return result.rows[0]?.trial_generations_used ?? null;
}

// Floored at 0 so a duplicate refund call can't push usage negative.
export async function decrementTrialGenerationsUsed(userId: string): Promise<void> {
  await pool.query(
    `UPDATE subscriptions SET trial_generations_used = GREATEST(trial_generations_used - 1, 0) WHERE user_id = $1`,
    [userId],
  );
}

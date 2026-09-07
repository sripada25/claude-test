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

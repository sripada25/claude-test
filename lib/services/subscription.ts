import { findGenerationQuotaUsed } from "../repositories/generation-quota.ts";
import { findSubscriptionByUserId } from "../repositories/subscription.ts";
import { findUserById } from "../repositories/user.ts";

const FREE_TIER_MONTHLY_QUOTA = 5; // AI-RULES.md - "You've used all 5 free generations this month"

export interface SubscriptionView {
  tier: "free" | "pro";
  status: "trialing" | "active" | "past_due" | "cancelled";
  trialDaysRemaining: number | null;
  trialGenerationsUsed: number;
  trialGenerationsLimit: number;
  emailVerified: boolean;
  quotaExhausted: boolean;
}

function daysRemaining(trialEndsAt: Date): number {
  const msRemaining = trialEndsAt.getTime() - Date.now();
  return Math.max(0, Math.ceil(msRemaining / (24 * 60 * 60 * 1000)));
}

function currentPeriodStart(): Date {
  const now = new Date();
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
}

// Every account-creation path inserts a subscriptions row - a missing one
// here is a data-integrity bug, not a normal outcome, so this throws rather
// than returning a "not found" result the caller might treat as valid.
export async function getSubscription(userId: string): Promise<SubscriptionView> {
  const subscription = await findSubscriptionByUserId(userId);
  if (!subscription) {
    throw new Error(`No subscription row for user ${userId}`);
  }

  const trialDaysRemaining =
    subscription.status === "trialing" && subscription.trialEndsAt
      ? daysRemaining(subscription.trialEndsAt)
      : null;

  const user = await findUserById(userId);
  const emailVerified = user?.emailVerifiedAt != null;

  const quotaExhausted =
    subscription.tier === "pro"
      ? false
      : (await findGenerationQuotaUsed(userId, currentPeriodStart())) >= FREE_TIER_MONTHLY_QUOTA;

  return {
    tier: subscription.tier,
    status: subscription.status,
    trialDaysRemaining,
    trialGenerationsUsed: subscription.trialGenerationsUsed,
    trialGenerationsLimit: subscription.trialGenerationsLimit,
    emailVerified,
    quotaExhausted,
  };
}

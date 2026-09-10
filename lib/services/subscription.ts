import { consumeFreeQuota, findGenerationQuotaUsed, refundFreeQuota } from "../repositories/generation-quota.ts";
import {
  decrementTrialGenerationsUsed,
  findSubscriptionByUserId,
  incrementTrialGenerationsUsed,
  type Subscription,
} from "../repositories/subscription.ts";
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

  const quotaExhausted = await isQuotaExhausted(userId, subscription);

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

// AI-RULES.md §7's three tiers, one branch per mechanism. Trialing users are
// checked against the trial's 40-total counter (already fetched on
// `subscription`, no extra query) - not the free tier's monthly cap, which
// this used to conflate with trial status (fixed as part of F3-2.5).
async function isQuotaExhausted(userId: string, subscription: Subscription): Promise<boolean> {
  if (subscription.tier === "pro") {
    // Pro's 20/hr·50/day·300/month fair-use cap (L093) isn't implemented -
    // unreachable until F6 ships a way to ever set tier to "pro".
    return false;
  }
  if (subscription.status === "trialing") {
    return subscription.trialGenerationsUsed >= subscription.trialGenerationsLimit;
  }
  return (await findGenerationQuotaUsed(userId, currentPeriodStart())) >= FREE_TIER_MONTHLY_QUOTA;
}

export type QuotaMechanism = "trial" | "free";

export type ConsumeQuotaResult =
  | { allowed: true; mechanism: QuotaMechanism }
  | { allowed: false; reason: "quota_exhausted" | "not_implemented" };

// The atomic enforcement AI-RULES.md §7 requires at enqueue time. No caller
// wired yet (F3-3.1 doesn't exist) - this is the tested primitive it will
// call.
export async function consumeGenerationQuota(userId: string): Promise<ConsumeQuotaResult> {
  const subscription = await findSubscriptionByUserId(userId);
  if (!subscription) {
    throw new Error(`No subscription row for user ${userId}`);
  }

  if (subscription.tier === "pro") {
    return { allowed: false, reason: "not_implemented" };
  }

  if (subscription.status === "trialing") {
    const used = await incrementTrialGenerationsUsed(userId, subscription.trialGenerationsLimit);
    return used !== null ? { allowed: true, mechanism: "trial" } : { allowed: false, reason: "quota_exhausted" };
  }

  const used = await consumeFreeQuota(userId, currentPeriodStart(), FREE_TIER_MONTHLY_QUOTA);
  return used !== null ? { allowed: true, mechanism: "free" } : { allowed: false, reason: "quota_exhausted" };
}

// "The user never pays for our failure" (AI-RULES.md §7). Caller must record
// which mechanism was charged at consume time and pass it back here - not
// wired to any caller yet, same as consumeGenerationQuota.
export async function refundGenerationQuota(userId: string, mechanism: QuotaMechanism): Promise<void> {
  if (mechanism === "trial") {
    await decrementTrialGenerationsUsed(userId);
    return;
  }
  await refundFreeQuota(userId, currentPeriodStart());
}

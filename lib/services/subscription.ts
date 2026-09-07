import { findSubscriptionByUserId } from "../repositories/subscription.ts";

export interface SubscriptionView {
  tier: "free" | "pro";
  status: "trialing" | "active" | "past_due" | "cancelled";
  trialDaysRemaining: number | null;
  trialGenerationsUsed: number;
  trialGenerationsLimit: number;
}

function daysRemaining(trialEndsAt: Date): number {
  const msRemaining = trialEndsAt.getTime() - Date.now();
  return Math.max(0, Math.ceil(msRemaining / (24 * 60 * 60 * 1000)));
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

  return {
    tier: subscription.tier,
    status: subscription.status,
    trialDaysRemaining,
    trialGenerationsUsed: subscription.trialGenerationsUsed,
    trialGenerationsLimit: subscription.trialGenerationsLimit,
  };
}

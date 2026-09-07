"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

interface UserSummary {
  fullName: string;
  planLabel: string;
}

function getInitials(fullName: string): string {
  const words = fullName.trim().split(/\s+/).filter(Boolean);
  return words
    .slice(0, 2)
    .map((word) => word[0]?.toUpperCase() ?? "")
    .join("");
}

function getPlanLabel(
  tier: string,
  status: string,
  trialDaysRemaining: number | null,
): string {
  if (tier === "pro") {
    return "Pro";
  }
  if (status === "trialing" && trialDaysRemaining) {
    return `Pro trial · ${trialDaysRemaining} days left`;
  }
  return "Free plan";
}

export function SidebarUser() {
  const [summary, setSummary] = useState<UserSummary | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      const [profileRes, subscriptionRes] = await Promise.all([
        fetch("/api/profile"),
        fetch("/api/subscription"),
      ]);

      if (!profileRes.ok || !subscriptionRes.ok) {
        return;
      }

      const profile = await profileRes.json();
      const subscription = await subscriptionRes.json();

      if (!cancelled) {
        setSummary({
          fullName: profile.fullName,
          planLabel: getPlanLabel(
            subscription.tier,
            subscription.status,
            subscription.trialDaysRemaining,
          ),
        });
      }
    }

    load();
    return () => {
      cancelled = true;
    };
  }, []);

  if (!summary) {
    return null;
  }

  return (
    <Link
      href="/app/settings"
      aria-label="Account settings"
      className="flex items-center gap-[11px] border-t border-sidebar-2 px-5 py-4"
    >
      <span
        aria-hidden="true"
        className="grid size-8 shrink-0 place-items-center bg-accent text-[11.5px] font-bold text-white"
      >
        {getInitials(summary.fullName)}
      </span>
      <div className="flex min-w-0 flex-col">
        <span className="truncate font-body text-[13px] font-semibold text-white">
          {summary.fullName}
        </span>
        <span className="font-mono text-[10.5px] text-sidebar-muted">{summary.planLabel}</span>
      </div>
    </Link>
  );
}

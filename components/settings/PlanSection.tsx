"use client";

import { ShieldCheck } from "lucide-react";
import { useEffect, useState } from "react";

// M09-1: Upgrade has nothing to call yet - F6 checkout is 0 of 6 backend
// tasks built. Rendered disabled per the issue's split, not omitted, since
// the plan comparison itself is real and worth showing today.
export function PlanSection() {
  const [tier, setTier] = useState<"free" | "pro" | null>(null);

  useEffect(() => {
    fetch("/api/subscription")
      .then((response) => (response.ok ? response.json() : null))
      .then((data: { tier: "free" | "pro" } | null) => setTier(data?.tier ?? "free"));
  }, []);

  return (
    <div id="plan" className="flex flex-col gap-2">
      <span className="font-mono text-[9.5px] font-semibold uppercase tracking-[0.8px] text-muted">
        Plan
      </span>
      <div className="flex flex-col gap-[14px] border border-border bg-surface p-[18px]">
        <div className="flex flex-wrap gap-4">
          <div className="flex flex-1 flex-col gap-[6px]">
            <div className="flex items-center gap-[6px]">
              <span className="font-body text-[13.5px] font-semibold text-ink">Free</span>
              {tier === "free" && (
                <span className="bg-surface-2 px-[7px] py-[2px] font-mono text-[8.5px] font-semibold text-ink-2">
                  CURRENT
                </span>
              )}
            </div>
            <p className="font-mono text-[10.5px] text-ink-2">
              Unlimited application tracking
              <br />5 document generations / month
            </p>
          </div>
          <div className="flex flex-1 flex-col gap-[6px]">
            <div className="flex items-center gap-[6px]">
              <span className="font-body text-[13.5px] font-semibold text-ink">Pro — ₹349 / month</span>
              {tier === "pro" && (
                <span className="bg-surface-2 px-[7px] py-[2px] font-mono text-[8.5px] font-semibold text-ink-2">
                  CURRENT
                </span>
              )}
            </div>
            <p className="font-mono text-[10.5px] text-ink-2">
              Unlimited document generations
              <br />₹2,999 / year — save ~28%
            </p>
            {tier === "free" && (
              <div className="flex items-center gap-2 pt-1">
                <button
                  type="button"
                  disabled
                  className="border border-border-strong bg-surface px-[14px] py-[8px] font-body text-[12.5px] font-semibold text-muted disabled:cursor-not-allowed"
                >
                  Upgrade
                </button>
                <span className="font-mono text-[10px] text-muted">Coming soon</span>
              </div>
            )}
          </div>
        </div>

        <div className="h-px w-full bg-border" />

        <div className="flex items-center gap-2">
          <ShieldCheck size={14} className="shrink-0 text-muted" aria-hidden />
          <p className="font-body text-[11.5px] text-muted">
            Payments handled by Razorpay — UPI, cards, net banking. India only.
          </p>
        </div>
      </div>
    </div>
  );
}

"use client";

import { Check, Info } from "lucide-react";
import { useEffect, useState } from "react";

export function GenerateCheckbox({
  checked,
  onChange,
  open,
}: {
  checked: boolean;
  onChange: (checked: boolean) => void;
  open: boolean;
}) {
  const [remaining, setRemaining] = useState<number | null>(null);
  const [limit, setLimit] = useState<number | null>(null);

  useEffect(() => {
    if (!open) {
      return;
    }
    let cancelled = false;

    fetch("/api/subscription")
      .then((response) => (response.ok ? response.json() : null))
      .then((data) => {
        if (cancelled || !data) {
          return;
        }
        setLimit(data.trialGenerationsLimit);
        setRemaining(Math.max(0, data.trialGenerationsLimit - data.trialGenerationsUsed));
      });

    return () => {
      cancelled = true;
    };
  }, [open]);

  const quotaKnown = remaining !== null && limit !== null;
  const disabled = quotaKnown && remaining === 0;

  return (
    <label className="flex items-center gap-[11px]">
      <span className="relative flex size-[18px] shrink-0 items-center justify-center">
        <input
          type="checkbox"
          checked={checked}
          onChange={(event) => onChange(event.target.checked)}
          disabled={disabled}
          className="peer absolute inset-0 size-[18px] appearance-none border-[1.3px] border-border-strong bg-surface checked:border-primary checked:bg-primary disabled:border-border disabled:bg-surface-2"
        />
        <Check size={13} className="pointer-events-none hidden text-white peer-checked:block" />
      </span>
      <span className="font-body text-[13px] text-ink">
        Generate a cover letter after saving{" "}
        <span
          className="inline-flex translate-y-[2px]"
          title="Uses your profile and this job's description"
        >
          <Info size={13} className="text-muted" />
        </span>
        {quotaKnown &&
          (remaining > 0 ? (
            <span className="block text-muted sm:inline"> ({remaining} of {limit} left)</span>
          ) : (
            <span className="block text-muted sm:inline">
              {" "}
              — 0 left this month. <a href="/app/settings/plan" className="text-accent underline">Upgrade</a>
            </span>
          ))}
      </span>
    </label>
  );
}

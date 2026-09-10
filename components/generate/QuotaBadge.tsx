"use client";

import { Info } from "lucide-react";
import { useEffect, useState } from "react";

interface QuotaData {
  tier: "free" | "pro";
  generationsUsed: number;
  generationsLimit: number | null;
}

export function QuotaBadge() {
  const [data, setData] = useState<QuotaData | null | undefined>(undefined);

  useEffect(() => {
    let cancelled = false;

    fetch("/api/subscription")
      .then((response) => (response.ok ? response.json() : null))
      .then((json) => {
        if (!cancelled) {
          setData(json);
        }
      });

    return () => {
      cancelled = true;
    };
  }, []);

  if (!data) {
    return null;
  }

  const isUnlimited = data.generationsLimit === null;
  const remaining = data.generationsLimit !== null ? Math.max(data.generationsLimit - data.generationsUsed, 0) : 0;

  return (
    <div role="status" aria-live="polite" className="flex items-center gap-2 bg-accent-soft px-3 py-[7px]">
      <Info size={15} className="text-muted" aria-hidden />
      {isUnlimited ? (
        <span className="font-body text-[12.5px] font-semibold text-accent">Unlimited generations</span>
      ) : (
        <>
          <span className="hidden font-body text-[12.5px] font-semibold text-accent sm:inline">
            {remaining} of {data.generationsLimit} generations left this month
          </span>
          <span className="font-body text-[12.5px] font-semibold text-accent sm:hidden">
            {remaining} of {data.generationsLimit} left
          </span>
        </>
      )}
    </div>
  );
}

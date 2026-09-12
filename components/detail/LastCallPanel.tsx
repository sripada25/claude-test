"use client";

import { Info } from "lucide-react";
import { useEffect, useState } from "react";

interface ApplicationEventSummary {
  type: string;
  description: string;
  createdAt: string;
}

const MONTH_FORMAT = new Intl.DateTimeFormat("en-US", { month: "short", timeZone: "UTC" });

function formatDate(iso: string): string {
  const date = new Date(iso);
  return `${date.getUTCDate()} ${MONTH_FORMAT.format(date)}`;
}

// Reuses the existing GET /api/applications/:id/events (Timeline's own
// endpoint) rather than a new one - the last call is just the newest
// call_logged event, filtered client-side.
export function LastCallPanel({ applicationId, refreshSignal }: { applicationId: string; refreshSignal: number }) {
  const [lastCall, setLastCall] = useState<ApplicationEventSummary | null | undefined>(undefined);

  useEffect(() => {
    let cancelled = false;

    fetch(`/api/applications/${applicationId}/events`)
      .then((response) => (response.ok ? response.json() : []))
      .then((data: ApplicationEventSummary[]) => {
        if (cancelled) {
          return;
        }
        setLastCall(data.find((event) => event.type === "call_logged") ?? null);
      });

    return () => {
      cancelled = true;
    };
  }, [applicationId, refreshSignal]);

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center gap-1.5">
        <span className="font-mono text-[10.5px] font-semibold uppercase tracking-[0.8px] text-ink-2">
          From the last call
        </span>
        <Info size={13} className="text-muted" aria-hidden />
      </div>
      <div className="flex min-h-[56px] flex-col justify-center gap-1 border border-border bg-surface px-[14px] py-[12px]">
        {lastCall ? (
          <>
            <span className="font-body text-[12.5px] text-ink">{lastCall.description}</span>
            <span className="font-mono text-[11px] text-muted">{formatDate(lastCall.createdAt)}</span>
          </>
        ) : (
          <span className="font-body text-[12px] text-muted">No calls logged yet.</span>
        )}
      </div>
    </div>
  );
}

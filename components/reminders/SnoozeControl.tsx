"use client";

import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { CSRF_HEADER_NAME, getCsrfToken } from "@/lib/security/csrf-client";

const HOUR_MS = 60 * 60 * 1000;

type SnoozeDuration = "tomorrow" | "3days" | "1week" | "custom";

// Tomorrow/3 days/1 week are plain offsets from now, matching F4-TASKS.md
// section 7's own listing; "Pick a date" parses a native date input as that
// date's local midnight.
function snoozeUntilFor(duration: SnoozeDuration, customDate: string): Date | null {
  if (duration === "tomorrow") {
    return new Date(Date.now() + 24 * HOUR_MS);
  }
  if (duration === "3days") {
    return new Date(Date.now() + 72 * HOUR_MS);
  }
  if (duration === "1week") {
    return new Date(Date.now() + 168 * HOUR_MS);
  }
  if (customDate) {
    const parsed = new Date(`${customDate}T00:00:00`);
    return Number.isNaN(parsed.getTime()) ? null : parsed;
  }
  return null;
}

// Self-contained, matching GenerateButton/ResultActions' convention: this
// owns its own PATCH call and loading/error state rather than handing a
// computed Date back to a parent to fetch with.
export function SnoozeControl({ reminderId, onResolved }: { reminderId: string; onResolved?: () => void }) {
  const [snoozing, setSnoozing] = useState(false);
  const [snoozeError, setSnoozeError] = useState<string | null>(null);
  const [customDate, setCustomDate] = useState("");

  async function handleSnooze(duration: SnoozeDuration) {
    const until = snoozeUntilFor(duration, customDate);
    if (!until) {
      return;
    }

    setSnoozing(true);
    setSnoozeError(null);

    let response: Response;
    try {
      response = await fetch(`/api/reminders/${reminderId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json", [CSRF_HEADER_NAME]: getCsrfToken() },
        body: JSON.stringify({ action: "snooze", until: until.toISOString() }),
      });
    } catch {
      setSnoozeError("Could not snooze this reminder. Try again.");
      setSnoozing(false);
      return;
    }

    setSnoozing(false);
    if (!response.ok) {
      setSnoozeError("Could not snooze this reminder. Try again.");
      return;
    }

    onResolved?.();
  }

  return (
    <div className="flex flex-col gap-2">
      <span className="font-mono text-[10.5px] font-semibold uppercase tracking-[0.8px] text-ink-2">Snooze</span>
      {snoozeError && <p className="font-body text-[12px] text-danger">{snoozeError}</p>}
      <div className="flex flex-wrap items-center gap-2">
        <Button variant="secondary" size="sm" onClick={() => handleSnooze("tomorrow")} disabled={snoozing}>
          Tomorrow
        </Button>
        <Button variant="secondary" size="sm" onClick={() => handleSnooze("3days")} disabled={snoozing}>
          3 days
        </Button>
        <Button variant="secondary" size="sm" onClick={() => handleSnooze("1week")} disabled={snoozing}>
          1 week
        </Button>
        <input
          type="date"
          value={customDate}
          onChange={(event) => setCustomDate(event.target.value)}
          aria-label="Pick a date to snooze until"
          className="border border-border-strong bg-surface px-2 py-[7px] font-body text-[12.5px] text-ink"
        />
        <Button variant="secondary" size="sm" onClick={() => handleSnooze("custom")} disabled={snoozing || !customDate}>
          Snooze to date
        </Button>
      </div>
    </div>
  );
}

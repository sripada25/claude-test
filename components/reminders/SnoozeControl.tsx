"use client";

import { useState } from "react";
import { ChevronDown } from "lucide-react";
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

// M08-R1: pen-verified as a single dropdown chip ("Snooze" + chevron), not
// four always-visible buttons - same four options and the same PATCH call
// underneath, unchanged from the original inline version. Self-contained,
// matching GenerateButton/ResultActions' convention: owns its own fetch and
// loading/error state.
export function SnoozeControl({ reminderId, onResolved }: { reminderId: string; onResolved?: () => void }) {
  const [open, setOpen] = useState(false);
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

    setOpen(false);
    onResolved?.();
  }

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen((current) => !current)}
        aria-expanded={open}
        className="flex items-center gap-1 border border-border-strong bg-surface px-[10px] py-[6px] font-body text-[12px] font-medium text-ink"
      >
        Snooze
        <ChevronDown size={13} className={open ? "rotate-180" : ""} />
      </button>

      {open && (
        <div className="absolute left-0 top-full z-10 mt-1 flex w-[200px] flex-col gap-2 border border-border-strong bg-surface p-3 shadow-[0_8px_24px_rgba(21,24,28,0.14)]">
          {snoozeError && <p className="font-body text-[12px] text-danger">{snoozeError}</p>}
          <button
            type="button"
            onClick={() => handleSnooze("tomorrow")}
            disabled={snoozing}
            className="p-1 text-left font-body text-[12.5px] text-ink hover:bg-surface-2"
          >
            Tomorrow
          </button>
          <button
            type="button"
            onClick={() => handleSnooze("3days")}
            disabled={snoozing}
            className="p-1 text-left font-body text-[12.5px] text-ink hover:bg-surface-2"
          >
            3 days
          </button>
          <button
            type="button"
            onClick={() => handleSnooze("1week")}
            disabled={snoozing}
            className="p-1 text-left font-body text-[12.5px] text-ink hover:bg-surface-2"
          >
            1 week
          </button>
          <div className="flex items-center gap-2">
            <input
              type="date"
              value={customDate}
              onChange={(event) => setCustomDate(event.target.value)}
              aria-label="Pick a date to snooze until"
              className="min-w-0 flex-1 border border-border-strong bg-surface px-2 py-[6px] font-body text-[12px] text-ink"
            />
            <button
              type="button"
              onClick={() => handleSnooze("custom")}
              disabled={snoozing || !customDate}
              className="shrink-0 font-body text-[12px] font-semibold text-primary disabled:text-muted"
            >
              Set
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

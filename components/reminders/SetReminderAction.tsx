"use client";

import { BellPlus } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { CSRF_HEADER_NAME, getCsrfToken } from "@/lib/security/csrf-client";

const DEFAULT_DAYS_OUT = 7;

function defaultDate(): string {
  const date = new Date(Date.now() + DEFAULT_DAYS_OUT * 24 * 60 * 60 * 1000);
  return date.toISOString().slice(0, 10);
}

type PanelState = "closed" | "picking" | "saving";

// Self-contained, matching SnoozeControl/GenerateButton's convention: owns
// its own POST call and loading/error state.
export function SetReminderAction({
  applicationId,
  onCreated,
}: {
  applicationId: string;
  onCreated?: () => void;
}) {
  const [panel, setPanel] = useState<PanelState>("closed");
  const [dueDate, setDueDate] = useState(defaultDate);
  const [error, setError] = useState<string | null>(null);

  function openPanel() {
    setDueDate(defaultDate());
    setError(null);
    setPanel("picking");
  }

  async function handleConfirm() {
    if (!dueDate) {
      return;
    }

    setPanel("saving");
    setError(null);

    let response: Response;
    try {
      response = await fetch(`/api/applications/${applicationId}/reminders`, {
        method: "POST",
        headers: { "Content-Type": "application/json", [CSRF_HEADER_NAME]: getCsrfToken() },
        body: JSON.stringify({ dueAt: `${dueDate}T00:00:00` }),
      });
    } catch {
      setError("Could not set a reminder. Try again.");
      setPanel("picking");
      return;
    }

    if (response.status === 409) {
      setError("You already have a follow-up reminder set for this application.");
      setPanel("picking");
      return;
    }

    if (!response.ok) {
      setError("Could not set a reminder. Try again.");
      setPanel("picking");
      return;
    }

    setPanel("closed");
    onCreated?.();
  }

  if (panel === "closed") {
    return (
      <Button variant="secondary" size="md" icon={<BellPlus size={15} aria-hidden />} onClick={openPanel}>
        Set a reminder
      </Button>
    );
  }

  return (
    <div className="flex flex-col gap-2 border border-border-strong bg-surface p-3">
      <span className="font-mono text-[10.5px] font-semibold uppercase tracking-[0.8px] text-ink-2">
        Set a reminder
      </span>
      {error && <p className="font-body text-[12px] text-danger">{error}</p>}
      <input
        type="date"
        value={dueDate}
        onChange={(event) => setDueDate(event.target.value)}
        aria-label="Reminder due date"
        className="border border-border-strong bg-surface px-2 py-[7px] font-body text-[12.5px] text-ink"
      />
      <div className="flex gap-2">
        <Button variant="primary" size="sm" onClick={handleConfirm} disabled={panel === "saving" || !dueDate}>
          {panel === "saving" ? "Saving..." : "Confirm"}
        </Button>
        <Button variant="secondary" size="sm" onClick={() => setPanel("closed")} disabled={panel === "saving"}>
          Cancel
        </Button>
      </div>
    </div>
  );
}

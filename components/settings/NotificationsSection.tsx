"use client";

import { useEffect, useState } from "react";
import { Toggle } from "@/components/ui/Toggle";
import { CSRF_HEADER_NAME, getCsrfToken } from "@/lib/security/csrf-client";

// M09-3: "Weekly pipeline summary" has no backend - no digest feature
// exists anywhere in this codebase. Rendered visibly off and disabled with
// a "Coming soon" note, matching M09-1's established treatment for other
// unbacked actions (Change password, Upgrade, Export), rather than omitted
// or made to look functional.
export function NotificationsSection() {
  const [reminderEmailsEnabled, setReminderEmailsEnabled] = useState<boolean | null>(null);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    fetch("/api/account")
      .then((response) => (response.ok ? response.json() : null))
      .then((data: { reminderEmailsEnabled: boolean } | null) => {
        if (!cancelled && data) {
          setReminderEmailsEnabled(data.reminderEmailsEnabled);
        }
      });

    return () => {
      cancelled = true;
    };
  }, []);

  async function handleToggle(next: boolean) {
    const previous = reminderEmailsEnabled;
    setReminderEmailsEnabled(next);
    setPending(true);
    setError(null);

    let response: Response;
    try {
      response = await fetch("/api/account", {
        method: "PATCH",
        headers: { "Content-Type": "application/json", [CSRF_HEADER_NAME]: getCsrfToken() },
        body: JSON.stringify({ reminderEmailsEnabled: next }),
      });
    } catch {
      setReminderEmailsEnabled(previous);
      setError("Could not save this change. Try again.");
      setPending(false);
      return;
    }

    setPending(false);
    if (!response.ok) {
      setReminderEmailsEnabled(previous);
      setError("Could not save this change. Try again.");
    }
  }

  return (
    <div id="notifications" className="flex flex-col gap-2">
      <span className="font-mono text-[9.5px] font-semibold uppercase tracking-[0.8px] text-muted">
        Notifications
      </span>
      <div className="flex flex-col gap-4 border border-border bg-surface p-4">
        <div className="flex items-center justify-between gap-3">
          <span className="font-body text-[12.5px] text-ink">Follow-up reminders by email</span>
          <Toggle
            checked={reminderEmailsEnabled ?? false}
            onChange={handleToggle}
            disabled={reminderEmailsEnabled === null || pending}
            aria-label="Follow-up reminders by email"
          />
        </div>

        <div className="h-px w-full bg-border" />

        <div className="flex items-center justify-between gap-3">
          <span className="font-body text-[12.5px] text-ink">Weekly pipeline summary</span>
          <div className="flex items-center gap-2">
            <span className="font-mono text-[10px] text-muted">Coming soon</span>
            <Toggle checked={false} onChange={() => {}} disabled aria-label="Weekly pipeline summary" />
          </div>
        </div>

        {error && <p className="font-body text-[12px] text-danger">{error}</p>}
      </div>
    </div>
  );
}

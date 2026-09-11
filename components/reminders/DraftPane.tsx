"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/Button";
import { CSRF_HEADER_NAME, getCsrfToken } from "@/lib/security/csrf-client";

const CARD_CLASS = "border border-border bg-surface px-7 py-[26px] max-md:px-4 max-md:py-4";
const HOUR_MS = 60 * 60 * 1000;

type SnoozeDuration = "tomorrow" | "3days" | "1week" | "custom";

// F4-3.3 is expected to extract this into a standalone SnoozeControl -
// this is the reference implementation, not a placeholder. "Tomorrow"/"3
// days"/"1 week" are plain offsets from now, matching F4-TASKS.md section
// 7's own listing; "Pick a date" parses a native date input as that date's
// local midnight.
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

type PaneState = "loading" | "ready" | "error";
type ConfirmingAction = "dismiss" | "sent" | null;

export function DraftPane({ reminderId, onResolved }: { reminderId: string; onResolved?: () => void }) {
  const [state, setState] = useState<PaneState>("loading");
  const [content, setContent] = useState("");
  const [draft, setDraft] = useState("");
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [snoozing, setSnoozing] = useState(false);
  const [snoozeError, setSnoozeError] = useState<string | null>(null);
  const [customDate, setCustomDate] = useState("");
  const [confirming, setConfirming] = useState<ConfirmingAction>(null);
  const [actionPending, setActionPending] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setState("loading");

    fetch(`/api/reminders/${reminderId}/draft`, {
      method: "POST",
      headers: { [CSRF_HEADER_NAME]: getCsrfToken() },
    })
      .then((response) => (response.ok ? response.json() : Promise.reject()))
      .then((data: { draftContent: string }) => {
        if (cancelled) {
          return;
        }
        setContent(data.draftContent);
        setDraft(data.draftContent);
        setState("ready");
      })
      .catch(() => {
        if (!cancelled) {
          setState("error");
        }
      });

    return () => {
      cancelled = true;
    };
  }, [reminderId]);

  const dirty = draft !== content;

  async function handleSave() {
    if (draft.trim() === "") {
      return;
    }

    setSaving(true);
    setSaveError(null);

    let response: Response;
    try {
      response = await fetch(`/api/reminders/${reminderId}/draft`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json", [CSRF_HEADER_NAME]: getCsrfToken() },
        body: JSON.stringify({ content: draft }),
      });
    } catch {
      setSaveError("Could not save your changes. Try again.");
      setSaving(false);
      return;
    }

    if (!response.ok) {
      setSaveError("Could not save your changes. Try again.");
      setSaving(false);
      return;
    }

    const data: { draftContent: string } = await response.json();
    setContent(data.draftContent);
    setDraft(data.draftContent);
    setSaving(false);
  }

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(draft);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard permission denied - nothing more to do silently.
    }
  }

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

  async function handleDismiss() {
    setActionPending(true);
    setActionError(null);

    let response: Response;
    try {
      response = await fetch(`/api/reminders/${reminderId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json", [CSRF_HEADER_NAME]: getCsrfToken() },
        body: JSON.stringify({ action: "dismiss" }),
      });
    } catch {
      setActionError("Could not dismiss this reminder. Try again.");
      setActionPending(false);
      return;
    }

    setActionPending(false);
    if (!response.ok) {
      setActionError("Could not dismiss this reminder. Try again.");
      return;
    }

    setConfirming(null);
    onResolved?.();
  }

  async function handleMarkSent() {
    setActionPending(true);
    setActionError(null);

    let response: Response;
    try {
      response = await fetch(`/api/reminders/${reminderId}/sent`, {
        method: "POST",
        headers: { [CSRF_HEADER_NAME]: getCsrfToken() },
      });
    } catch {
      setActionError("Could not mark this reminder as sent. Try again.");
      setActionPending(false);
      return;
    }

    setActionPending(false);
    if (!response.ok) {
      setActionError("Could not mark this reminder as sent. Try again.");
      return;
    }

    setConfirming(null);
    onResolved?.();
  }

  if (state === "loading") {
    return (
      <div aria-live="polite" className={CARD_CLASS}>
        <div className="flex flex-col gap-[14px]" aria-hidden>
          <div className="h-4 w-1/3 animate-pulse bg-surface-2" />
          <div className="h-3 w-full animate-pulse bg-surface-2" />
          <div className="h-3 w-full animate-pulse bg-surface-2" />
          <div className="h-3 w-5/6 animate-pulse bg-surface-2" />
        </div>
      </div>
    );
  }

  if (state === "error") {
    return (
      <div className={CARD_CLASS}>
        <p className="font-body text-[13px] text-danger">Could not load this draft.</p>
      </div>
    );
  }

  return (
    <div className={`${CARD_CLASS} flex flex-col gap-4`}>
      <textarea
        value={draft}
        onChange={(event) => setDraft(event.target.value)}
        rows={10}
        className="w-full resize-y bg-transparent font-body text-[13px] leading-[1.6] text-ink-2 focus-visible:outline-none"
      />

      {saveError && <p className="font-body text-[12px] text-danger">{saveError}</p>}

      <div className="flex flex-wrap gap-2">
        {dirty && (
          <Button variant="primary" size="sm" onClick={handleSave} disabled={saving || draft.trim() === ""}>
            {saving ? "Saving..." : "Save"}
          </Button>
        )}
        <Button variant="secondary" size="sm" onClick={handleCopy}>
          {copied ? "Copied!" : "Copy"}
        </Button>
      </div>

      <div className="flex flex-col gap-2 border-t border-border pt-4">
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
          <Button
            variant="secondary"
            size="sm"
            onClick={() => handleSnooze("custom")}
            disabled={snoozing || !customDate}
          >
            Snooze to date
          </Button>
        </div>
      </div>

      {actionError && <p className="font-body text-[12px] text-danger">{actionError}</p>}

      {confirming === "dismiss" ? (
        <div className="flex flex-wrap items-center gap-[10px] border-t border-border pt-4">
          <span className="font-body text-[12px] font-semibold text-ink-2">
            Dismiss? You won&apos;t be reminded about this again.
          </span>
          <Button variant="secondary" size="sm" onClick={handleDismiss} disabled={actionPending}>
            {actionPending ? "Dismissing..." : "Confirm"}
          </Button>
          <Button variant="secondary" size="sm" onClick={() => setConfirming(null)} disabled={actionPending}>
            Cancel
          </Button>
        </div>
      ) : confirming === "sent" ? (
        <div className="flex flex-wrap items-center gap-[10px] border-t border-border pt-4">
          <span className="font-body text-[12px] font-semibold text-ink-2">
            Mark as sent? This closes the reminder.
          </span>
          <Button variant="primary" size="sm" onClick={handleMarkSent} disabled={actionPending}>
            {actionPending ? "Marking..." : "Confirm"}
          </Button>
          <Button variant="secondary" size="sm" onClick={() => setConfirming(null)} disabled={actionPending}>
            Cancel
          </Button>
        </div>
      ) : (
        <div className="flex flex-wrap gap-2 border-t border-border pt-4">
          <Button variant="secondary" size="sm" onClick={() => setConfirming("dismiss")}>
            Dismiss
          </Button>
          <Button variant="primary" size="sm" onClick={() => setConfirming("sent")}>
            Mark as sent
          </Button>
        </div>
      )}
    </div>
  );
}

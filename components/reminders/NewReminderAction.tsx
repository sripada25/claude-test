"use client";

import { Plus } from "lucide-react";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/Button";
import { CSRF_HEADER_NAME, getCsrfToken } from "@/lib/security/csrf-client";

interface ApplicationOption {
  id: string;
  company: string;
  role: string;
}

const DEFAULT_DAYS_OUT = 7;

function defaultDate(): string {
  const date = new Date(Date.now() + DEFAULT_DAYS_OUT * 24 * 60 * 60 * 1000);
  return date.toISOString().slice(0, 10);
}

type PanelState = "closed" | "picking" | "saving";

// M08-R1: the global queue's "New reminder" needs an application picker
// SetReminderAction (F4-3.6, M05-scoped) never needed - a plain native
// <select> populated from the existing applications list, matching this
// project's established "un-designed interaction -> plain native form
// control" convention.
export function NewReminderAction({ onCreated }: { onCreated?: () => void }) {
  const [panel, setPanel] = useState<PanelState>("closed");
  const [applications, setApplications] = useState<ApplicationOption[] | null>(null);
  const [applicationId, setApplicationId] = useState("");
  const [dueDate, setDueDate] = useState(defaultDate);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (panel !== "picking" || applications) {
      return;
    }

    fetch("/api/applications?sort=recent")
      .then((response) => (response.ok ? response.json() : []))
      .then((data: ApplicationOption[]) => {
        setApplications(data);
        if (data.length > 0) {
          setApplicationId(data[0].id);
        }
      });
  }, [panel, applications]);

  function openPanel() {
    setDueDate(defaultDate());
    setError(null);
    setPanel("picking");
  }

  async function handleConfirm() {
    if (!dueDate || !applicationId) {
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
      setError("That application already has a follow-up reminder set.");
      setPanel("picking");
      return;
    }

    if (!response.ok) {
      setError("Could not set a reminder. Try again.");
      setPanel("picking");
      return;
    }

    setPanel("closed");
    setApplications(null);
    onCreated?.();
  }

  return (
    <div className="relative">
      <Button
        variant="primary"
        size="sm"
        icon={<Plus size={14} aria-hidden />}
        onClick={openPanel}
        disabled={panel !== "closed"}
      >
        New reminder
      </Button>

      {panel !== "closed" && (
        <div className="absolute right-0 top-full z-10 mt-1 flex w-[240px] flex-col gap-2 border border-border-strong bg-surface p-3 shadow-[0_8px_24px_rgba(21,24,28,0.14)]">
          {error && <p className="font-body text-[12px] text-danger">{error}</p>}
          {!applications ? (
            <p className="font-body text-[12.5px] text-muted">Loading applications...</p>
          ) : applications.length === 0 ? (
            <p className="font-body text-[12.5px] text-muted">No applications yet.</p>
          ) : (
            <select
              value={applicationId}
              onChange={(event) => setApplicationId(event.target.value)}
              aria-label="Application"
              className="border border-border-strong bg-surface px-2 py-[7px] font-body text-[12.5px] text-ink"
            >
              {applications.map((application) => (
                <option key={application.id} value={application.id}>
                  {application.company} — {application.role}
                </option>
              ))}
            </select>
          )}
          <input
            type="date"
            value={dueDate}
            onChange={(event) => setDueDate(event.target.value)}
            aria-label="Reminder due date"
            className="border border-border-strong bg-surface px-2 py-[7px] font-body text-[12.5px] text-ink"
          />
          <div className="flex gap-2">
            <Button
              variant="primary"
              size="sm"
              onClick={handleConfirm}
              disabled={panel === "saving" || !dueDate || !applicationId}
            >
              {panel === "saving" ? "Saving..." : "Confirm"}
            </Button>
            <Button variant="secondary" size="sm" onClick={() => setPanel("closed")} disabled={panel === "saving"}>
              Cancel
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

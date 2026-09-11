import { Mail } from "lucide-react";

export interface ApplicationReminderSummary {
  id: string;
  type: "application_followup" | "post_interview";
  status: "pending" | "snoozed" | "sent" | "dismissed";
  dueAt: string;
  snoozedUntil: string | null;
  sentAt: string | null;
  dismissedAt: string | null;
}

const TYPE_LABEL: Record<ApplicationReminderSummary["type"], string> = {
  application_followup: "Application follow-up",
  post_interview: "Post-interview",
};

const MONTH_FORMAT = new Intl.DateTimeFormat("en-US", { month: "short", timeZone: "UTC" });

function formatDate(iso: string): string {
  const date = new Date(iso);
  return `${date.getUTCDate()} ${MONTH_FORMAT.format(date)}`;
}

// A resolved reminder still shows, styled by its outcome - matches
// Timeline's "a record of what happened" spirit rather than making a
// sent/dismissed reminder vanish from this tab.
function statusText(reminder: ApplicationReminderSummary): string {
  if (reminder.status === "sent" && reminder.sentAt) {
    return `Sent ${formatDate(reminder.sentAt)}`;
  }
  if (reminder.status === "dismissed" && reminder.dismissedAt) {
    return `Dismissed ${formatDate(reminder.dismissedAt)}`;
  }
  if (reminder.status === "snoozed" && reminder.snoozedUntil) {
    return `Snoozed until ${formatDate(reminder.snoozedUntil)}`;
  }
  return `Due ${formatDate(reminder.dueAt)}`;
}

export function RemindersTab({ reminders }: { reminders: ApplicationReminderSummary[] }) {
  if (reminders.length === 0) {
    return (
      <p className="font-body text-[13px] text-muted">No reminders yet. Set one from the actions panel.</p>
    );
  }

  return (
    <ol className="flex flex-col border border-border bg-surface">
      {reminders.map((reminder, index) => (
        <li
          key={reminder.id}
          className={`flex items-center gap-3 p-[13px_16px] max-sm:flex-wrap ${index > 0 ? "border-t border-border" : ""}`}
        >
          <span className="flex size-[26px] shrink-0 items-center justify-center bg-surface-2">
            <Mail size={14} className="text-primary" />
          </span>
          <span className="flex-1 font-body text-[13px] text-ink">{TYPE_LABEL[reminder.type]}</span>
          <span className="font-mono text-[11.5px] text-muted max-sm:w-full max-sm:pl-[38px]">
            {statusText(reminder)}
          </span>
        </li>
      ))}
    </ol>
  );
}

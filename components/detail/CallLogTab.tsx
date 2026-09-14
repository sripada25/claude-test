import { Phone } from "lucide-react";

export interface CallLogEventSummary {
  id: string;
  description: string;
  createdAt: string;
}

const MONTH_FORMAT = new Intl.DateTimeFormat("en-US", { month: "short", timeZone: "UTC" });

function formatDate(iso: string): string {
  const date = new Date(iso);
  return `${date.getUTCDate()} ${MONTH_FORMAT.format(date)}`;
}

export function CallLogTab({ events }: { events: CallLogEventSummary[] }) {
  if (events.length === 0) {
    return <p className="font-body text-[13px] text-muted">No calls logged yet.</p>;
  }

  return (
    <ol className="flex flex-col border border-border bg-surface">
      {events.map((event, index) => (
        <li
          key={event.id}
          className={`flex items-center gap-3 p-[13px_16px] max-sm:flex-wrap ${index > 0 ? "border-t border-border" : ""}`}
        >
          <span className="flex size-[26px] shrink-0 items-center justify-center bg-surface-2">
            <Phone size={14} className="text-primary" />
          </span>
          <span className="flex-1 font-body text-[13px] text-ink">{event.description}</span>
          <span className="font-mono text-[11.5px] text-muted max-sm:w-full max-sm:pl-[38px]">
            {formatDate(event.createdAt)}
          </span>
        </li>
      ))}
    </ol>
  );
}

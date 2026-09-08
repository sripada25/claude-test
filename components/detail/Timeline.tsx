"use client";

import { Circle, CircleDot, CirclePlus, FileText, Info, Mail, Phone } from "lucide-react";
import { useEffect, useState } from "react";
import { STAGES } from "@/components/board/stages";

interface TimelineEvent {
  id: string;
  type: string;
  description: string;
  createdAt: string;
  metadata: { from?: string; to?: string };
}

const MONTH_FORMAT = new Intl.DateTimeFormat("en-US", { month: "short", timeZone: "UTC" });

function formatEventDate(createdAt: string): string {
  const date = new Date(createdAt);
  return `${date.getUTCDate()} ${MONTH_FORMAT.format(date)}`;
}

function eventIcon(event: TimelineEvent) {
  if (event.type === "status_changed") {
    const stage = STAGES.find((s) => s.value === event.metadata?.to);
    const colorClass = stage ? stage.colorClass.replace("bg-", "text-") : "text-primary";
    return <CircleDot size={14} className={colorClass} />;
  }
  if (event.type === "call_logged") {
    return <Phone size={14} className="text-primary" />;
  }
  if (event.type === "follow_up_sent") {
    return <Mail size={14} className="text-primary" />;
  }
  if (event.type === "document_generated") {
    return <FileText size={14} className="text-primary" />;
  }
  if (event.type === "created") {
    return <CirclePlus size={14} className="text-primary" />;
  }
  return <Circle size={14} className="text-primary" />;
}

export function Timeline({
  applicationId,
  refreshSignal,
}: {
  applicationId: string;
  refreshSignal: number;
}) {
  const [events, setEvents] = useState<TimelineEvent[]>([]);

  useEffect(() => {
    let cancelled = false;

    fetch(`/api/applications/${applicationId}/events`)
      .then((response) => (response.ok ? response.json() : []))
      .then((data) => {
        if (!cancelled) {
          setEvents(data);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [applicationId, refreshSignal]);

  if (events.length === 0) {
    return null;
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center gap-[5px]">
        <span className="font-mono text-[10.5px] font-semibold uppercase tracking-[0.8px] text-ink-2">
          Timeline
        </span>
        <span title="A record of what happened with this application">
          <Info size={13} className="text-muted" />
        </span>
      </div>
      <ol className="flex flex-col border border-border bg-surface">
        {events.map((event, index) => (
          <li
            key={event.id}
            className={`flex items-center gap-3 p-[13px_16px] max-sm:flex-wrap ${index > 0 ? "border-t border-border" : ""}`}
          >
            <span className="flex size-[26px] shrink-0 items-center justify-center bg-surface-2">
              {eventIcon(event)}
            </span>
            <span className="flex-1 font-body text-[13px] text-ink">{event.description}</span>
            <span className="font-mono text-[11.5px] text-muted max-sm:w-full max-sm:pl-[38px]">
              {formatEventDate(event.createdAt)}
            </span>
          </li>
        ))}
      </ol>
    </div>
  );
}

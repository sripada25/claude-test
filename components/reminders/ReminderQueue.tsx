"use client";

import { Mail } from "lucide-react";
import { useEffect, useState } from "react";

export interface ReminderQueueItem {
  id: string;
  type: "application_followup" | "post_interview";
  dueAt: string;
  applicationId: string;
  company: string;
  role: string;
  dateApplied: string | null;
  interviewAt: string | null;
}

interface ReminderQueueData {
  dueNow: ReminderQueueItem[];
  upcoming: ReminderQueueItem[];
}

const TYPE_LABEL: Record<ReminderQueueItem["type"], string> = {
  application_followup: "Application follow-up",
  post_interview: "Post-interview",
};

const MS_PER_DAY = 1000 * 60 * 60 * 24;

// F4-2.3 deliberately returns raw dateApplied/interviewAt instead of a
// precomputed string - each rule's own trigger date (F4-TASKS.md section 0)
// decides which one applies here, same technique as cardTags.ts's ageTag().
function daysElapsed(item: ReminderQueueItem): number | null {
  const referenceDate = item.type === "post_interview" ? item.interviewAt : item.dateApplied;
  if (!referenceDate) {
    return null;
  }
  return Math.max(0, Math.floor((Date.now() - new Date(referenceDate).getTime()) / MS_PER_DAY));
}

function formatDaysElapsed(days: number | null): string {
  if (days === null) {
    return "";
  }
  if (days === 0) {
    return "Today";
  }
  return days === 1 ? "1 day" : `${days} days`;
}

function ReminderRow({ item, index }: { item: ReminderQueueItem; index: number }) {
  return (
    <li
      className={`flex items-center gap-3 p-[13px_16px] max-sm:flex-wrap ${index > 0 ? "border-t border-border" : ""}`}
    >
      <span className="flex size-[26px] shrink-0 items-center justify-center bg-surface-2">
        <Mail size={14} className="text-primary" />
      </span>
      <span className="flex-1 font-body text-[13px] text-ink">
        {item.company} — {item.role}
      </span>
      <span className="font-mono text-[11.5px] text-muted max-sm:w-full max-sm:pl-[38px]">
        {TYPE_LABEL[item.type]} · {formatDaysElapsed(daysElapsed(item))}
      </span>
    </li>
  );
}

function ReminderSection({ title, items }: { title: string; items: ReminderQueueItem[] }) {
  if (items.length === 0) {
    return null;
  }

  return (
    <div className="flex flex-col gap-3">
      <span className="font-mono text-[10.5px] font-semibold uppercase tracking-[0.8px] text-ink-2">{title}</span>
      <ol className="flex flex-col border border-border bg-surface">
        {items.map((item, index) => (
          <ReminderRow key={item.id} item={item} index={index} />
        ))}
      </ol>
    </div>
  );
}

export function ReminderQueue() {
  const [queue, setQueue] = useState<ReminderQueueData | null>(null);

  useEffect(() => {
    let cancelled = false;

    fetch("/api/reminders")
      .then((response) => (response.ok ? response.json() : { dueNow: [], upcoming: [] }))
      .then((data: ReminderQueueData) => {
        if (!cancelled) {
          setQueue(data);
        }
      });

    return () => {
      cancelled = true;
    };
  }, []);

  if (!queue) {
    return null;
  }

  if (queue.dueNow.length === 0 && queue.upcoming.length === 0) {
    return <p className="font-body text-[13px] text-muted">No reminders due.</p>;
  }

  return (
    <div className="flex flex-col gap-6">
      <ReminderSection title="Due now" items={queue.dueNow} />
      <ReminderSection title="Upcoming" items={queue.upcoming} />
    </div>
  );
}

"use client";

import { Mail } from "lucide-react";

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

export interface ReminderQueueData {
  dueNow: ReminderQueueItem[];
  upcoming: ReminderQueueItem[];
  done: ReminderQueueItem[];
}

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

// M08-R1: pen-verified tag text (Admin.pen, GPMVt) - a single combined tag,
// not separate type+days text. application_followup shows elapsed days;
// post_interview reads "Interview prep" with no day count, even though
// that label doesn't literally restate R2's post-interview trigger - used
// verbatim per the mockup.
function tagText(item: ReminderQueueItem): string {
  if (item.type === "post_interview") {
    return "Interview prep";
  }
  const days = daysElapsed(item);
  if (days === null) {
    return "Follow-up";
  }
  return days === 1 ? "Follow-up · 1 day" : `Follow-up · ${days} days`;
}

function ReminderRow({
  item,
  index,
  selected,
  onSelect,
}: {
  item: ReminderQueueItem;
  index: number;
  selected: boolean;
  onSelect: (id: string) => void;
}) {
  return (
    <li className={index > 0 ? "border-t border-border" : ""}>
      <button
        type="button"
        onClick={() => onSelect(item.id)}
        aria-pressed={selected}
        className={`flex w-full items-center gap-3 p-[13px_16px] text-left max-sm:flex-wrap ${
          selected ? "bg-accent-soft" : ""
        }`}
      >
        <span className="flex size-[26px] shrink-0 items-center justify-center bg-surface-2">
          <Mail size={14} className="text-primary" />
        </span>
        <span className="flex-1 font-body text-[13px] text-ink">
          {item.company} — {item.role}
        </span>
        <span className="font-mono text-[11.5px] text-muted max-sm:w-full max-sm:pl-[38px]">{tagText(item)}</span>
      </button>
    </li>
  );
}

function ReminderSection({
  title,
  items,
  selectedId,
  onSelect,
}: {
  title: string;
  items: ReminderQueueItem[];
  selectedId: string | null;
  onSelect: (id: string) => void;
}) {
  if (items.length === 0) {
    return null;
  }

  return (
    <div className="flex flex-col gap-3">
      <span className="font-mono text-[10.5px] font-semibold uppercase tracking-[0.8px] text-ink-2">{title}</span>
      <ol className="flex flex-col border border-border bg-surface">
        {items.map((item, index) => (
          <ReminderRow key={item.id} item={item} index={index} selected={item.id === selectedId} onSelect={onSelect} />
        ))}
      </ol>
    </div>
  );
}

// M08-R1: converted from self-fetching to controlled, now that the real
// assembling page exists - same reasoning M06-10's report already
// documented for QuotaBadge ("started self-fetching... converted to
// controlled once the real page was known").
export function ReminderQueue({
  queue,
  selectedId,
  onSelect,
}: {
  queue: ReminderQueueData;
  selectedId: string | null;
  onSelect: (id: string) => void;
}) {
  if (queue.dueNow.length === 0 && queue.upcoming.length === 0 && queue.done.length === 0) {
    return <p className="font-body text-[13px] text-muted">No reminders due.</p>;
  }

  return (
    <div className="flex flex-col gap-6">
      <ReminderSection title="Due now" items={queue.dueNow} selectedId={selectedId} onSelect={onSelect} />
      <ReminderSection title="Upcoming" items={queue.upcoming} selectedId={selectedId} onSelect={onSelect} />
      <ReminderSection title="Done" items={queue.done} selectedId={selectedId} onSelect={onSelect} />
    </div>
  );
}

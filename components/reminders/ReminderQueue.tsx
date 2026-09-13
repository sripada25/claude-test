"use client";

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

// M08-R3: Upcoming rows count down to due_at (Mockup 08's "In N days"), the
// opposite direction from Due/Done's tagText() below, which counts elapsed
// time since the type's own trigger date. Conflating the two was M08-R1's
// bug - an Upcoming item showed how long it had been due, not how long
// until it would be.
function daysUntilDue(item: ReminderQueueItem): number {
  return Math.max(0, Math.ceil((new Date(item.dueAt).getTime() - Date.now()) / MS_PER_DAY));
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

// M08-R3: pen-verified per-type pill color (GPMVt's Due row tags) -
// application_followup is accent, post_interview is neutral - matches
// cardTags.ts/CardTag's existing "follow-up"/"default" variant colors
// exactly, so this reuses the same visual language rather than inventing a
// second one.
const TAG_CLASSES: Record<ReminderQueueItem["type"], string> = {
  application_followup: "bg-accent-soft text-accent",
  post_interview: "bg-surface-2 text-ink-2",
};

function ReminderRow({
  item,
  selected,
  onSelect,
  upcoming,
}: {
  item: ReminderQueueItem;
  selected: boolean;
  onSelect: (id: string) => void;
  upcoming?: boolean;
}) {
  return (
    <li>
      <button
        type="button"
        onClick={() => onSelect(item.id)}
        aria-pressed={selected}
        className={`flex w-full flex-col items-start gap-1 border bg-surface p-[10px] text-left ${
          selected ? "border-accent" : "border-border hover:border-border-strong"
        } ${upcoming ? "opacity-65" : ""}`}
      >
        {upcoming ? (
          <>
            <span className="font-body text-[11.5px] font-semibold text-ink">
              {item.company} — {item.role}
            </span>
            <span className="font-mono text-[10px] text-muted">In {daysUntilDue(item)} days</span>
          </>
        ) : (
          <>
            <span className="font-body text-[12.5px] font-semibold text-ink">{item.company}</span>
            <span className="font-body text-[11px] text-ink-2">{item.role}</span>
            <span
              className={`inline-flex items-center px-[7px] py-[3px] font-mono text-[9.5px] font-semibold ${TAG_CLASSES[item.type]}`}
            >
              {tagText(item)}
            </span>
          </>
        )}
      </button>
    </li>
  );
}

function ReminderSection({
  title,
  items,
  selectedId,
  onSelect,
  upcoming,
}: {
  title: string;
  items: ReminderQueueItem[];
  selectedId: string | null;
  onSelect: (id: string) => void;
  upcoming?: boolean;
}) {
  if (items.length === 0) {
    return null;
  }

  return (
    <div className="flex flex-col gap-2">
      <span className="font-mono text-[9.5px] font-semibold uppercase tracking-[0.8px] text-muted">{title}</span>
      <ol className="flex flex-col gap-2">
        {items.map((item) => (
          <ReminderRow
            key={item.id}
            item={item}
            selected={item.id === selectedId}
            onSelect={onSelect}
            upcoming={upcoming}
          />
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
      <ReminderSection title="Upcoming" items={queue.upcoming} selectedId={selectedId} onSelect={onSelect} upcoming />
      <ReminderSection title="Done" items={queue.done} selectedId={selectedId} onSelect={onSelect} />
    </div>
  );
}

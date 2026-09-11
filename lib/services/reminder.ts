import { findPendingRemindersForUser, type ReminderQueueRow } from "../repositories/reminder.ts";

export interface ReminderQueueItem {
  id: string;
  type: ReminderQueueRow["type"];
  dueAt: string;
  applicationId: string;
  company: string;
  role: string;
  dateApplied: string | null;
  interviewAt: string | null;
}

export interface ReminderQueue {
  dueNow: ReminderQueueItem[];
  upcoming: ReminderQueueItem[];
}

function toQueueItem(row: ReminderQueueRow): ReminderQueueItem {
  return {
    id: row.id,
    type: row.type,
    dueAt: row.dueAt.toISOString(),
    applicationId: row.applicationId,
    company: row.company,
    role: row.role,
    dateApplied: row.dateApplied,
    interviewAt: row.interviewAt ? row.interviewAt.toISOString() : null,
  };
}

// "Due now" vs "upcoming" is a business rule (CLAUDE.md section 4), so it's
// decided here, not in the repository's SQL. In practice "upcoming" only
// ever holds same-day reminders not quite due yet - R1's due_at is always
// today at 9am local when inserted (F4-2.1), R2's is interview_at + 24h
// inserted within a one-hour window around that threshold - so nothing here
// is ever far in the future; no separate lookahead cap is needed.
export async function getReminderQueue(userId: string): Promise<ReminderQueue> {
  const rows = await findPendingRemindersForUser(userId);
  const now = Date.now();

  const dueNow: ReminderQueueItem[] = [];
  const upcoming: ReminderQueueItem[] = [];

  for (const row of rows) {
    const item = toQueueItem(row);
    if (row.dueAt.getTime() <= now) {
      dueNow.push(item);
    } else {
      upcoming.push(item);
    }
  }

  return { dueNow, upcoming };
}

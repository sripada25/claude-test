import { pool, type Queryable } from "../db.ts";

export type ReminderType = "application_followup" | "post_interview";
export type ReminderStatus = "pending" | "snoozed" | "sent" | "dismissed";

export interface FollowupCandidate {
  applicationId: string;
  userId: string;
  timezone: string;
  dateApplied: string;
}

// R1 candidates. Deliberately no SQL-side date pre-filter: CURRENT_DATE is
// the server's own date, and comparing it against a per-user local calendar
// day is exactly the class of bug L041 exists to prevent - a pre-filter
// using the server's date could exclude a valid candidate near a UTC
// midnight boundary. The precise per-user timezone check in the scheduler is
// the sole source of truth for whether a reminder fires; status IN (...)
// already bounds this to a small set at this system's scale (CLAUDE.md's own
// "~0.05% of a small Postgres instance at 1,000 users").
export async function findApplicationFollowupCandidates(): Promise<FollowupCandidate[]> {
  const result = await pool.query<{
    application_id: string;
    user_id: string;
    timezone: string;
    date_applied: string;
  }>(
    `SELECT a.id AS application_id, a.user_id, u.timezone, a.date_applied
     FROM applications a
     JOIN users u ON u.id = a.user_id
     WHERE a.status IN ('applied', 'assessment', 'interview')
       AND a.deleted_at IS NULL
       AND a.date_applied IS NOT NULL`,
  );
  return result.rows.map((row) => ({
    applicationId: row.application_id,
    userId: row.user_id,
    timezone: row.timezone,
    dateApplied: row.date_applied,
  }));
}

export async function insertReminder(params: {
  userId: string;
  applicationId: string;
  type: ReminderType;
  dueAt: Date;
}): Promise<boolean> {
  const result = await pool.query(
    `INSERT INTO reminders (user_id, application_id, type, due_at)
     VALUES ($1, $2, $3, $4)
     ON CONFLICT (application_id, type) DO NOTHING`,
    [params.userId, params.applicationId, params.type, params.dueAt],
  );
  return (result.rowCount ?? 0) > 0;
}

// R2 needs no per-row timezone handling - interview_at is a TIMESTAMPTZ, so
// "24 hours after" is plain instant arithmetic, already correct by
// construction. Matches the spec's own "within the hour window" phrasing: a
// one-hour catch window, not an open-ended backlog scan.
export async function insertPostInterviewReminders(): Promise<number> {
  const result = await pool.query(
    `INSERT INTO reminders (user_id, application_id, type, due_at)
     SELECT a.user_id, a.id, 'post_interview', a.interview_at + interval '24 hours'
     FROM applications a
     WHERE a.status = 'interview'
       AND a.interview_at IS NOT NULL
       AND a.interview_at <= now() - interval '24 hours'
       AND a.interview_at > now() - interval '25 hours'
       AND a.deleted_at IS NULL
     ON CONFLICT (application_id, type) DO NOTHING`,
  );
  return result.rowCount ?? 0;
}

export interface DueNotificationCandidate {
  reminderId: string;
  type: ReminderType;
  userId: string;
  email: string;
  reminderEmailsEnabled: boolean;
  company: string;
  role: string;
}

// F4-2.2: oldest-due first, bounded to a small batch per tick - the
// notifier's own daily-cap check is the real safety net, this is just an
// upper bound so one tick never does unbounded work.
//
// F4-2.5 amendment (issue #272): status IN ('pending','snoozed') instead of
// just 'pending', gated by snoozed_until - a snoozed reminder must not
// email while its snooze is active, but becomes emailable again the moment
// snoozed_until passes, with no separate job to flip it back to 'pending'.
export async function findDueUnnotifiedReminders(limit: number): Promise<DueNotificationCandidate[]> {
  const result = await pool.query<{
    reminder_id: string;
    type: ReminderType;
    user_id: string;
    email: string;
    reminder_emails_enabled: boolean;
    company: string;
    role: string;
  }>(
    `SELECT r.id AS reminder_id, r.type, u.id AS user_id, u.email, u.reminder_emails_enabled,
            a.company, a.role
     FROM reminders r
     JOIN users u ON u.id = r.user_id
     JOIN applications a ON a.id = r.application_id
     WHERE r.status IN ('pending', 'snoozed')
       AND (r.snoozed_until IS NULL OR r.snoozed_until <= now())
       AND r.due_at <= now()
       AND r.notified_at IS NULL
     ORDER BY r.due_at ASC
     LIMIT $1`,
    [limit],
  );
  return result.rows.map((row) => ({
    reminderId: row.reminder_id,
    type: row.type,
    userId: row.user_id,
    email: row.email,
    reminderEmailsEnabled: row.reminder_emails_enabled,
    company: row.company,
    role: row.role,
  }));
}

export async function markReminderNotified(reminderId: string): Promise<void> {
  await pool.query(`UPDATE reminders SET notified_at = now() WHERE id = $1`, [reminderId]);
}

export interface ReminderQueueRow {
  id: string;
  type: ReminderType;
  dueAt: Date;
  applicationId: string;
  company: string;
  role: string;
  dateApplied: string | null;
  interviewAt: Date | null;
}

// F4-2.3: one flat, sorted list - splitting it into "due now" vs "upcoming"
// is the service layer's job (CLAUDE.md section 4: repository is SQL only,
// no business rules). deleted_at IS NULL on the joined application is
// mandatory: a soft-deleted application's reminders still exist (cascade
// delete only fires on a hard user deletion), so a trashed application's
// reminder must never surface here.
//
// F4-2.5 amendment (issue #274): status IN ('pending','snoozed') instead of
// just 'pending', gated by snoozed_until - an actively snoozed reminder must
// stay out of the queue, but reappears the instant its snooze expires, with
// no separate job flipping status back to 'pending'.
export async function findPendingRemindersForUser(userId: string): Promise<ReminderQueueRow[]> {
  const result = await pool.query<{
    id: string;
    type: ReminderType;
    due_at: Date;
    application_id: string;
    company: string;
    role: string;
    date_applied: string | null;
    interview_at: Date | null;
  }>(
    `SELECT r.id, r.type, r.due_at, a.id AS application_id, a.company, a.role,
            a.date_applied, a.interview_at
     FROM reminders r
     JOIN applications a ON a.id = r.application_id
     WHERE r.user_id = $1
       AND r.status IN ('pending', 'snoozed')
       AND (r.snoozed_until IS NULL OR r.snoozed_until <= now())
       AND a.deleted_at IS NULL
     ORDER BY r.due_at ASC`,
    [userId],
  );
  return result.rows.map((row) => ({
    id: row.id,
    type: row.type,
    dueAt: row.due_at,
    applicationId: row.application_id,
    company: row.company,
    role: row.role,
    dateApplied: row.date_applied,
    interviewAt: row.interview_at,
  }));
}

export interface ReminderForDraft {
  id: string;
  type: ReminderType;
  company: string;
  role: string;
  dateApplied: string | null;
  draftContent: string | null;
}

// F4-2.4: scoped by user_id in the same query, not checked afterward - same
// generic-404 convention as findDocumentForUser/findJobForUser.
export async function findReminderForUser(reminderId: string, userId: string): Promise<ReminderForDraft | null> {
  const result = await pool.query<{
    id: string;
    type: ReminderType;
    company: string;
    role: string;
    date_applied: string | null;
    draft_content: string | null;
  }>(
    `SELECT r.id, r.type, a.company, a.role, a.date_applied, r.draft_content
     FROM reminders r
     JOIN applications a ON a.id = r.application_id
     WHERE r.id = $1 AND r.user_id = $2`,
    [reminderId, userId],
  );
  if (!result.rows[0]) {
    return null;
  }
  const row = result.rows[0];
  return {
    id: row.id,
    type: row.type,
    company: row.company,
    role: row.role,
    dateApplied: row.date_applied,
    draftContent: row.draft_content,
  };
}

export async function updateReminderDraft(reminderId: string, content: string): Promise<void> {
  await pool.query(`UPDATE reminders SET draft_content = $2, updated_at = now() WHERE id = $1`, [
    reminderId,
    content,
  ]);
}

export interface SnoozedReminder {
  id: string;
  applicationId: string;
  status: ReminderStatus;
  snoozedUntil: Date;
}

// F4-2.5: ownership, existence, and "not already terminal" (sent/dismissed)
// all collapse into this one scoped UPDATE's WHERE clause - same
// generic-404 convention as findDocumentForUser/findJobForUser, extended to
// one more disqualifying condition. Re-snoozing an already-snoozed reminder
// (changing the length) is allowed - only 'sent'/'dismissed' are terminal.
// db is a Queryable, not the pool directly, so the caller can wrap this with
// the applications.follow_up_snoozed_until write in one transaction.
export async function snoozeReminder(
  db: Queryable,
  reminderId: string,
  userId: string,
  until: Date,
): Promise<SnoozedReminder | null> {
  const result = await db.query<{
    id: string;
    application_id: string;
    status: ReminderStatus;
    snoozed_until: Date;
  }>(
    `UPDATE reminders
     SET status = 'snoozed', snoozed_until = $3, updated_at = now()
     WHERE id = $1 AND user_id = $2 AND status IN ('pending', 'snoozed')
     RETURNING id, application_id, status, snoozed_until`,
    [reminderId, userId, until],
  );
  if (!result.rows[0]) {
    return null;
  }
  const row = result.rows[0];
  return { id: row.id, applicationId: row.application_id, status: row.status, snoozedUntil: row.snoozed_until };
}

// Never scoped by a client-supplied applicationId - the caller derives this
// id from the already-ownership-verified reminder row returned above, never
// from request input directly.
export async function setApplicationFollowUpSnoozedUntil(
  db: Queryable,
  applicationId: string,
  until: Date,
): Promise<void> {
  await db.query(`UPDATE applications SET follow_up_snoozed_until = $2 WHERE id = $1`, [applicationId, until]);
}

export interface DismissedReminder {
  id: string;
  status: ReminderStatus;
  dismissedAt: Date;
}

// F4-2.5: single-table write, no application_events row and no
// applications write - dismiss isn't a cancellation mechanism for the
// board's derived tag (F4-TASKS.md section 0's own table only lists
// follow_up_sent events as cancelling R1/R2), only F4-2.6 (Mark as sent) is.
export async function dismissReminder(reminderId: string, userId: string): Promise<DismissedReminder | null> {
  const result = await pool.query<{ id: string; status: ReminderStatus; dismissed_at: Date }>(
    `UPDATE reminders
     SET status = 'dismissed', dismissed_at = now(), updated_at = now()
     WHERE id = $1 AND user_id = $2 AND status IN ('pending', 'snoozed')
     RETURNING id, status, dismissed_at`,
    [reminderId, userId],
  );
  if (!result.rows[0]) {
    return null;
  }
  const row = result.rows[0];
  return { id: row.id, status: row.status, dismissedAt: row.dismissed_at };
}

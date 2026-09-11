import { pool } from "../db.ts";

export type ReminderType = "application_followup" | "post_interview";

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
     WHERE r.status = 'pending'
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

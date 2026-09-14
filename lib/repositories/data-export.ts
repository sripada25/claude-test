import { pool } from "../db.ts";

export interface ExportAccount {
  email: string;
  timezone: string;
  createdAt: Date;
}

// M09-6: deliberately its own narrow SELECT, never password_hash - same
// discipline as findUserForLogin/findPasswordHashById in user.ts.
export async function findAccountForExport(userId: string): Promise<ExportAccount | null> {
  const result = await pool.query<{ email: string; timezone: string; created_at: Date }>(
    `SELECT email, timezone, created_at FROM users WHERE id = $1`,
    [userId],
  );
  if (!result.rows[0]) {
    return null;
  }
  return {
    email: result.rows[0].email,
    timezone: result.rows[0].timezone,
    createdAt: result.rows[0].created_at,
  };
}

export interface ExportProfile {
  fullName: string;
  currentRole: string | null;
  targetRole: string | null;
  contactEmail: string | null;
  contactEmailVerified: boolean;
  yearsExperience: number | null;
  monthsExperience: number | null;
  skills: string[];
  salaryAmount: number | null;
  salaryCurrency: string | null;
  salaryPeriod: string | null;
  locationPreference: string | null;
  completedAt: Date | null;
}

export async function findProfileForExport(userId: string): Promise<ExportProfile | null> {
  const result = await pool.query<{
    full_name: string;
    current_role: string | null;
    target_role: string | null;
    contact_email: string | null;
    contact_email_verified_at: Date | null;
    years_experience: number | null;
    months_experience: number | null;
    skills: string[];
    salary_amount: string | null;
    salary_currency: string | null;
    salary_period: string | null;
    location_preference: string | null;
    completed_at: Date | null;
  }>(
    `SELECT full_name, "current_role", target_role, contact_email, contact_email_verified_at,
            years_experience, months_experience, skills, salary_amount, salary_currency,
            salary_period, location_preference, completed_at
     FROM profiles WHERE user_id = $1`,
    [userId],
  );
  if (!result.rows[0]) {
    return null;
  }
  const row = result.rows[0];
  return {
    fullName: row.full_name,
    currentRole: row.current_role,
    targetRole: row.target_role,
    contactEmail: row.contact_email,
    contactEmailVerified: row.contact_email_verified_at !== null,
    yearsExperience: row.years_experience,
    monthsExperience: row.months_experience,
    skills: row.skills,
    salaryAmount: row.salary_amount === null ? null : Number(row.salary_amount),
    salaryCurrency: row.salary_currency,
    salaryPeriod: row.salary_period,
    locationPreference: row.location_preference,
    completedAt: row.completed_at,
  };
}

export interface ExportEmploymentEntry {
  employer: string;
  title: string;
  startDate: string;
  endDate: string | null;
}

export async function findEmploymentHistoryForExport(userId: string): Promise<ExportEmploymentEntry[]> {
  const result = await pool.query<{ employer: string; title: string; start_date: string; end_date: string | null }>(
    `SELECT employer, title, start_date, end_date FROM employment_history
     WHERE user_id = $1 ORDER BY start_date DESC`,
    [userId],
  );
  return result.rows.map((row) => ({
    employer: row.employer,
    title: row.title,
    startDate: row.start_date,
    endDate: row.end_date,
  }));
}

export interface ExportSubscription {
  tier: string;
  status: string;
  trialEndsAt: Date | null;
  trialGenerationsLimit: number;
  trialGenerationsUsed: number;
  currentPeriodEnd: Date | null;
}

export async function findSubscriptionForExport(userId: string): Promise<ExportSubscription | null> {
  const result = await pool.query<{
    tier: string;
    status: string;
    trial_ends_at: Date | null;
    trial_generations_limit: number;
    trial_generations_used: number;
    current_period_end: Date | null;
  }>(
    `SELECT tier, status, trial_ends_at, trial_generations_limit, trial_generations_used, current_period_end
     FROM subscriptions WHERE user_id = $1`,
    [userId],
  );
  if (!result.rows[0]) {
    return null;
  }
  const row = result.rows[0];
  return {
    tier: row.tier,
    status: row.status,
    trialEndsAt: row.trial_ends_at,
    trialGenerationsLimit: row.trial_generations_limit,
    trialGenerationsUsed: row.trial_generations_used,
    currentPeriodEnd: row.current_period_end,
  };
}

export interface ExportEvent {
  type: string;
  description: string;
  metadata: Record<string, unknown>;
  createdAt: Date;
}

export interface ExportReminder {
  type: string;
  status: string;
  dueAt: Date;
  snoozedUntil: Date | null;
  draftContent: string | null;
  sentAt: Date | null;
  dismissedAt: Date | null;
}

export interface ExportDocument {
  type: string;
  content: string;
  jdSnapshot: string | null;
  provider: string;
  model: string;
  createdAt: Date;
}

export interface ExportApplication {
  id: string;
  company: string;
  role: string;
  status: string;
  jobDescription: string | null;
  source: string | null;
  sourceUrl: string | null;
  dateApplied: string | null;
  assessmentDueAt: Date | null;
  interviewAt: Date | null;
  notes: string | null;
  contactEmail: string | null;
  createdAt: Date;
  events: ExportEvent[];
  reminders: ExportReminder[];
  documents: ExportDocument[];
}

// M09-6 / L123: filters deleted_at IS NULL, same as every other query
// touching applications - a resurfaced trashed application in an export is
// the same authorization failure L123 already treats a resurfaced
// board/search result as. Children are never soft-deleted themselves
// (DATABASE_quarterfinal.md §3.1), so scoping the parent query is enough -
// their own queries below are scoped to these same application ids, not
// re-filtered independently.
export async function findApplicationsForExport(userId: string): Promise<ExportApplication[]> {
  const applicationsResult = await pool.query<{
    id: string;
    company: string;
    role: string;
    status: string;
    job_description: string | null;
    source: string | null;
    source_url: string | null;
    date_applied: string | null;
    assessment_due_at: Date | null;
    interview_at: Date | null;
    notes: string | null;
    contact_email: string | null;
    created_at: Date;
  }>(
    `SELECT id, company, role, status, job_description, source, source_url, date_applied,
            assessment_due_at, interview_at, notes, contact_email, created_at
     FROM applications
     WHERE user_id = $1 AND deleted_at IS NULL
     ORDER BY created_at DESC`,
    [userId],
  );

  const applicationIds = applicationsResult.rows.map((row) => row.id);
  if (applicationIds.length === 0) {
    return [];
  }

  const [eventsResult, remindersResult, documentsResult] = await Promise.all([
    pool.query<{
      application_id: string;
      type: string;
      description: string;
      metadata: Record<string, unknown>;
      created_at: Date;
    }>(
      `SELECT application_id, type, description, metadata, created_at
       FROM application_events WHERE application_id = ANY($1::uuid[]) ORDER BY created_at ASC`,
      [applicationIds],
    ),
    pool.query<{
      application_id: string;
      type: string;
      status: string;
      due_at: Date;
      snoozed_until: Date | null;
      draft_content: string | null;
      sent_at: Date | null;
      dismissed_at: Date | null;
    }>(
      `SELECT application_id, type, status, due_at, snoozed_until, draft_content, sent_at, dismissed_at
       FROM reminders WHERE application_id = ANY($1::uuid[])`,
      [applicationIds],
    ),
    pool.query<{
      application_id: string;
      type: string;
      content: string;
      jd_snapshot: string | null;
      provider: string;
      model: string;
      created_at: Date;
    }>(
      `SELECT application_id, type, content, jd_snapshot, provider, model, created_at
       FROM documents WHERE application_id = ANY($1::uuid[]) ORDER BY created_at ASC`,
      [applicationIds],
    ),
  ]);

  const eventsByApplication = new Map<string, ExportEvent[]>();
  for (const row of eventsResult.rows) {
    const list = eventsByApplication.get(row.application_id) ?? [];
    list.push({ type: row.type, description: row.description, metadata: row.metadata, createdAt: row.created_at });
    eventsByApplication.set(row.application_id, list);
  }

  const remindersByApplication = new Map<string, ExportReminder[]>();
  for (const row of remindersResult.rows) {
    const list = remindersByApplication.get(row.application_id) ?? [];
    list.push({
      type: row.type,
      status: row.status,
      dueAt: row.due_at,
      snoozedUntil: row.snoozed_until,
      draftContent: row.draft_content,
      sentAt: row.sent_at,
      dismissedAt: row.dismissed_at,
    });
    remindersByApplication.set(row.application_id, list);
  }

  const documentsByApplication = new Map<string, ExportDocument[]>();
  for (const row of documentsResult.rows) {
    const list = documentsByApplication.get(row.application_id) ?? [];
    list.push({
      type: row.type,
      content: row.content,
      jdSnapshot: row.jd_snapshot,
      provider: row.provider,
      model: row.model,
      createdAt: row.created_at,
    });
    documentsByApplication.set(row.application_id, list);
  }

  return applicationsResult.rows.map((row) => ({
    id: row.id,
    company: row.company,
    role: row.role,
    status: row.status,
    jobDescription: row.job_description,
    source: row.source,
    sourceUrl: row.source_url,
    dateApplied: row.date_applied,
    assessmentDueAt: row.assessment_due_at,
    interviewAt: row.interview_at,
    notes: row.notes,
    contactEmail: row.contact_email,
    createdAt: row.created_at,
    events: eventsByApplication.get(row.id) ?? [],
    reminders: remindersByApplication.get(row.id) ?? [],
    documents: documentsByApplication.get(row.id) ?? [],
  }));
}

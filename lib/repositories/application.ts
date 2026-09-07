import { pool, type Queryable } from "../db.ts";

export type ApplicationStatus =
  | "saved"
  | "applied"
  | "assessment"
  | "interview"
  | "offer"
  | "rejected";

export type ApplicationSource =
  | "linkedin"
  | "naukri"
  | "indeed"
  | "referral"
  | "company_site"
  | "other";

export interface Application {
  id: string;
  userId: string;
  company: string;
  role: string;
  status: ApplicationStatus;
  jobDescription: string | null;
  source: ApplicationSource | null;
  sourceUrl: string | null;
  dateApplied: string | null;
  assessmentDueAt: Date | null;
  interviewAt: Date | null;
  notes: string | null;
  lastActivityAt: Date;
  createdAt: Date;
  updatedAt: Date;
}

export type ApplicationSort = "recent" | "oldest_activity" | "date_applied" | "company_az";

export interface ListApplicationsOptions {
  q?: string;
  statuses: ApplicationStatus[];
  sources: ApplicationSource[];
  sort: ApplicationSort;
}

export interface ApplicationListItem extends Application {
  followUpDue: boolean;
}

interface ApplicationRow {
  id: string;
  user_id: string;
  company: string;
  role: string;
  status: ApplicationStatus;
  job_description: string | null;
  source: ApplicationSource | null;
  source_url: string | null;
  date_applied: string | null;
  assessment_due_at: Date | null;
  interview_at: Date | null;
  notes: string | null;
  last_activity_at: Date;
  created_at: Date;
  updated_at: Date;
}

function toApplication(row: ApplicationRow): Application {
  return {
    id: row.id,
    userId: row.user_id,
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
    lastActivityAt: row.last_activity_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export async function insertApplication(
  db: Queryable,
  userId: string,
  input: {
    company: string;
    role: string;
    status: ApplicationStatus;
    jobDescription: string | null;
    source: ApplicationSource | null;
    sourceUrl: string | null;
    dateApplied: string | null;
  },
): Promise<Application> {
  const result = await db.query<ApplicationRow>(
    `INSERT INTO applications (user_id, company, role, status, job_description, source, source_url, date_applied)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
     RETURNING id, user_id, company, role, status, job_description, source, source_url, date_applied,
               assessment_due_at, interview_at, notes, last_activity_at, created_at, updated_at`,
    [
      userId,
      input.company,
      input.role,
      input.status,
      input.jobDescription,
      input.source,
      input.sourceUrl,
      input.dateApplied,
    ],
  );
  return toApplication(result.rows[0]);
}

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// Independent of findUserApplications (a different access pattern - one row
// or none, not a filtered array) but enforces the exact same discipline:
// deleted_at IS NULL and ownership from the session, never the URL
// (SECURITY_quarterfinal.md §14 - "detail fetch" is explicitly in scope).
export async function findUserApplicationById(
  userId: string,
  id: string,
): Promise<Application | null> {
  if (!UUID_PATTERN.test(id)) {
    return null;
  }

  const result = await pool.query<ApplicationRow>(
    `SELECT id, user_id, company, role, status, job_description, source, source_url, date_applied,
            assessment_due_at, interview_at, notes, last_activity_at, created_at, updated_at
     FROM applications
     WHERE id = $1 AND user_id = $2 AND deleted_at IS NULL`,
    [id, userId],
  );

  return result.rows[0] ? toApplication(result.rows[0]) : null;
}

// Full static column list every time (read-modify-write from the service),
// not a dynamically-built SQL statement - matches updateProfileFields's
// style elsewhere in this codebase. Ownership + soft-delete filtered on the
// write itself, not just the caller's earlier read.
export async function updateApplicationFields(
  db: Queryable,
  userId: string,
  id: string,
  fields: Pick<
    Application,
    | "company"
    | "role"
    | "status"
    | "jobDescription"
    | "source"
    | "sourceUrl"
    | "dateApplied"
    | "notes"
    | "lastActivityAt"
  >,
): Promise<Application | null> {
  const result = await db.query<ApplicationRow>(
    `UPDATE applications
     SET company = $3, role = $4, status = $5, job_description = $6, source = $7,
         source_url = $8, date_applied = $9, notes = $10, last_activity_at = $11,
         updated_at = now()
     WHERE id = $1 AND user_id = $2 AND deleted_at IS NULL
     RETURNING id, user_id, company, role, status, job_description, source, source_url, date_applied,
               assessment_due_at, interview_at, notes, last_activity_at, created_at, updated_at`,
    [
      id,
      userId,
      fields.company,
      fields.role,
      fields.status,
      fields.jobDescription,
      fields.source,
      fields.sourceUrl,
      fields.dateApplied,
      fields.notes,
      fields.lastActivityAt,
    ],
  );

  return result.rows[0] ? toApplication(result.rows[0]) : null;
}

// Only a rejected application can be soft-deleted (DATABASE_quarterfinal.md
// §3.1 / M05-03's doc) - status = 'rejected' is re-checked here even though
// the service already checked it, guarding against a race between the two.
export async function softDeleteApplication(userId: string, id: string): Promise<Application | null> {
  const result = await pool.query<ApplicationRow>(
    `UPDATE applications
     SET deleted_at = now(), updated_at = now()
     WHERE id = $1 AND user_id = $2 AND deleted_at IS NULL AND status = 'rejected'
     RETURNING id, user_id, company, role, status, job_description, source, source_url, date_applied,
               assessment_due_at, interview_at, notes, last_activity_at, created_at, updated_at`,
    [id, userId],
  );

  return result.rows[0] ? toApplication(result.rows[0]) : null;
}

const SORT_CLAUSES: Record<ApplicationSort, string> = {
  recent: "last_activity_at DESC",
  oldest_activity: "last_activity_at ASC",
  date_applied: "date_applied DESC NULLS LAST",
  company_az: "company ASC",
};

// The sole read path for listing a user's applications (SECURITY_quarterfinal.md
// §14 / G13) - board, list, search, and filter all go through this one function
// so the deleted_at IS NULL discipline can't be forgotten on a parallel path.
export async function findUserApplications(
  userId: string,
  opts: ListApplicationsOptions,
): Promise<ApplicationListItem[]> {
  const conditions: string[] = ["user_id = $1", "deleted_at IS NULL"];
  const params: unknown[] = [userId];

  if (opts.q) {
    params.push(`%${opts.q}%`);
    conditions.push(`(company ILIKE $${params.length} OR role ILIKE $${params.length})`);
  }

  if (opts.statuses.length > 0) {
    params.push(opts.statuses);
    conditions.push(`status = ANY($${params.length}::application_status[])`);
  }

  if (opts.sources.length > 0) {
    params.push(opts.sources);
    conditions.push(`source = ANY($${params.length}::application_source[])`);
  }

  const result = await pool.query<ApplicationRow & { follow_up_due: boolean }>(
    `SELECT id, user_id, company, role, status, job_description, source, source_url, date_applied,
            assessment_due_at, interview_at, notes, last_activity_at, created_at, updated_at,
            (
              status IN ('applied','assessment','interview')
              AND date_applied IS NOT NULL
              AND date_applied < (now() - interval '7 days')
              AND NOT EXISTS (
                SELECT 1 FROM application_events e
                WHERE e.application_id = applications.id AND e.type = 'follow_up_sent'
              )
            ) AS follow_up_due
     FROM applications
     WHERE ${conditions.join(" AND ")}
     ORDER BY ${SORT_CLAUSES[opts.sort]}`,
    params,
  );

  return result.rows.map((row) => ({ ...toApplication(row), followUpDue: row.follow_up_due }));
}

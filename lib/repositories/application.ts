import { pool } from "../db.ts";

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
  const result = await pool.query<ApplicationRow>(
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

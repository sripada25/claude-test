import { pool, type Queryable } from "../db.ts";
import type { GenerationInput } from "../ai/types.ts";

export type DocumentType = "cover_letter" | "resume";
export type QuotaMechanism = "trial" | "free";

export interface QueuedJob {
  id: string;
  userId: string;
  applicationId: string;
  type: DocumentType;
  promptInputs: GenerationInput;
  attempts: number;
  quotaMechanism: QuotaMechanism | null;
}

interface QueuedJobRow {
  id: string;
  user_id: string;
  application_id: string;
  type: DocumentType;
  prompt_inputs: GenerationInput;
  attempts: number;
  quota_mechanism: QuotaMechanism | null;
}

// FOR UPDATE SKIP LOCKED guards against a second worker instance double-
// claiming the same row - defensive for a single-process worker today, but
// costs nothing and needs no new dependency. next_attempt_at excludes a job
// that's still backing off after a retryable failure (F3-2.6).
export async function claimNextQueuedJob(): Promise<QueuedJob | null> {
  const result = await pool.query<QueuedJobRow>(
    `UPDATE generation_jobs
     SET status = 'running', attempts = attempts + 1
     WHERE id = (
       SELECT id FROM generation_jobs
       WHERE status = 'queued' AND (next_attempt_at IS NULL OR next_attempt_at <= now())
       ORDER BY created_at ASC
       LIMIT 1
       FOR UPDATE SKIP LOCKED
     )
     RETURNING id, user_id, application_id, type, prompt_inputs, attempts, quota_mechanism`,
  );

  if (result.rows.length === 0) {
    return null;
  }

  const row = result.rows[0];
  return {
    id: row.id,
    userId: row.user_id,
    applicationId: row.application_id,
    type: row.type,
    promptInputs: row.prompt_inputs,
    attempts: row.attempts,
    quotaMechanism: row.quota_mechanism,
  };
}

export interface NewGenerationJob {
  userId: string;
  applicationId: string;
  type: DocumentType;
  promptInputs: GenerationInput;
  quotaMechanism: QuotaMechanism;
}

// The first function that creates a job row - everything above only claims
// or updates existing ones, since nothing enqueued real jobs until F3-3.1.
export async function insertGenerationJob(job: NewGenerationJob): Promise<string> {
  const result = await pool.query<{ id: string }>(
    `INSERT INTO generation_jobs (user_id, application_id, type, prompt_inputs, quota_mechanism)
     VALUES ($1, $2, $3, $4, $5)
     RETURNING id`,
    [job.userId, job.applicationId, job.type, JSON.stringify(job.promptInputs), job.quotaMechanism],
  );
  return result.rows[0].id;
}

// L094's queue depth cap: counts jobs not yet resolved for this user.
export async function countPendingJobsForUser(userId: string): Promise<number> {
  const result = await pool.query<{ count: string }>(
    `SELECT count(*) FROM generation_jobs WHERE user_id = $1 AND status IN ('queued', 'running')`,
    [userId],
  );
  return Number(result.rows[0].count);
}

// Re-queues a job after a transient failure, backing off for delaySeconds
// before it's eligible to be claimed again. Does not touch `attempts` -
// that only increments on claim.
export async function requeueForRetry(db: Queryable, jobId: string, delaySeconds: number): Promise<void> {
  await db.query(
    `UPDATE generation_jobs SET status = 'queued', next_attempt_at = now() + make_interval(secs => $2)
     WHERE id = $1`,
    [jobId, delaySeconds],
  );
}

export async function markJobSucceeded(db: Queryable, jobId: string): Promise<void> {
  await db.query(`UPDATE generation_jobs SET status = 'succeeded', completed_at = now() WHERE id = $1`, [jobId]);
}

export async function markJobFailed(db: Queryable, jobId: string, errorClass: string): Promise<void> {
  await db.query(
    `UPDATE generation_jobs SET status = 'failed', error_class = $2, completed_at = now() WHERE id = $1`,
    [jobId, errorClass],
  );
}

export type JobStatus = "queued" | "running" | "succeeded" | "failed";

export interface JobStatusRecord {
  id: string;
  status: JobStatus;
  errorClass: string | null;
}

// Scoped by user_id in the same query, not checked afterward - "doesn't
// exist" and "isn't yours" are the same null result, matching this
// codebase's established generic-404 convention (never leaks existence).
export async function findJobForUser(jobId: string, userId: string): Promise<JobStatusRecord | null> {
  const result = await pool.query<{ id: string; status: JobStatus; error_class: string | null }>(
    `SELECT id, status, error_class FROM generation_jobs WHERE id = $1 AND user_id = $2`,
    [jobId, userId],
  );
  if (!result.rows[0]) {
    return null;
  }
  return { id: result.rows[0].id, status: result.rows[0].status, errorClass: result.rows[0].error_class };
}

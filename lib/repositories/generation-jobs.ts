import { pool, type Queryable } from "../db.ts";
import type { GenerationInput } from "../ai/types.ts";

export type DocumentType = "cover_letter" | "resume";

export interface QueuedJob {
  id: string;
  userId: string;
  applicationId: string;
  type: DocumentType;
  promptInputs: GenerationInput;
}

interface QueuedJobRow {
  id: string;
  user_id: string;
  application_id: string;
  type: DocumentType;
  prompt_inputs: GenerationInput;
}

// FOR UPDATE SKIP LOCKED guards against a second worker instance double-
// claiming the same row - defensive for a single-process worker today, but
// costs nothing and needs no new dependency.
export async function claimNextQueuedJob(): Promise<QueuedJob | null> {
  const result = await pool.query<QueuedJobRow>(
    `UPDATE generation_jobs
     SET status = 'running', attempts = attempts + 1
     WHERE id = (
       SELECT id FROM generation_jobs
       WHERE status = 'queued'
       ORDER BY created_at ASC
       LIMIT 1
       FOR UPDATE SKIP LOCKED
     )
     RETURNING id, user_id, application_id, type, prompt_inputs`,
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
  };
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

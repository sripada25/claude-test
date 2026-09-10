import { pool } from "../db.ts";
import { getAIProvider, getAIProviderMetadata } from "../ai/provider.ts";
import type { AIErrorClass } from "../ai/types.ts";
import {
  claimNextQueuedJob,
  markJobFailed,
  markJobSucceeded,
  requeueForRetry,
} from "../repositories/generation-jobs.ts";

// One tick every 4s = 15/min by construction - Gemini's own RPM cap (L034),
// no separate token-bucket needed. This is the actual reason a queue exists
// (F3-2.4), not a nice-to-have.
const POLL_INTERVAL_MS = 4000;

// AI-RULES.md §8.1: timeout/429/503 auto-retry, everything else is
// permanent (bad_request/safety_block/validation_failed never retry).
const RETRYABLE_ERROR_CLASSES = new Set<AIErrorClass>(["timeout", "rate_limited", "unavailable"]);

// 2 attempts total, unambiguous across every doc reference (L096, the
// attempts column comment, this task's own line) - so only one retry ever
// happens, and only backoff[0] can ever fire. backoff[1] (8s) is kept for
// the documented schedule rather than discarded, and the lookup extends
// cleanly if MAX_ATTEMPTS is ever raised.
const MAX_ATTEMPTS = 2;
const BACKOFF_SECONDS = [2, 8];

function backoffSecondsForAttempt(attempts: number): number {
  const index = Math.min(attempts - 1, BACKOFF_SECONDS.length - 1);
  return BACKOFF_SECONDS[index];
}

export async function processNextJob(): Promise<"no-job" | "succeeded" | "failed" | "retrying"> {
  const job = await claimNextQueuedJob();
  if (!job) {
    return "no-job";
  }

  const provider = getAIProvider();
  const result =
    job.type === "cover_letter"
      ? await provider.generateCoverLetter(job.promptInputs)
      : await provider.generateResume(job.promptInputs);

  if (!result.success) {
    const canRetry = RETRYABLE_ERROR_CLASSES.has(result.error.errorClass) && job.attempts < MAX_ATTEMPTS;
    if (canRetry) {
      await requeueForRetry(pool, job.id, backoffSecondsForAttempt(job.attempts));
      return "retrying";
    }
    await markJobFailed(pool, job.id, result.error.errorClass);
    return "failed";
  }

  const { provider: providerName, model } = getAIProviderMetadata();
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    // jd_snapshot is always set explicitly, never NULL - NULL means "same as
    // the application's current JD" (L090), but the JD may have been edited
    // since this job was enqueued. This document was generated against the
    // snapshotted text, so it must say so, not silently point at whatever
    // the application shows today.
    await client.query(
      `INSERT INTO documents (application_id, user_id, type, content, jd_snapshot, provider, model)
       VALUES ($1, $2, $3, $4, $5, $6, $7)`,
      [
        job.applicationId,
        job.userId,
        job.type,
        result.data,
        job.promptInputs.jobDescription,
        providerName,
        model,
      ],
    );
    await markJobSucceeded(client, job.id);
    await client.query("COMMIT");
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }

  return "succeeded";
}

let workerTimer: ReturnType<typeof setTimeout> | null = null;

// Self-rescheduling setTimeout, not setInterval - a Gemini call can run
// longer than 4s, and setInterval would let ticks overlap and double-claim.
export function startGenerationWorker(): void {
  if (workerTimer) {
    return;
  }

  const tick = async () => {
    try {
      await processNextJob();
    } catch (error) {
      console.error("[generation-worker] tick failed:", error instanceof Error ? error.message : error);
    } finally {
      workerTimer = setTimeout(tick, POLL_INTERVAL_MS);
    }
  };

  workerTimer = setTimeout(tick, POLL_INTERVAL_MS);
}

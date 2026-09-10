import { pool } from "../db.ts";

export interface AiUsageRecord {
  userId: string;
  jobId: string | null;
  provider: string;
  model: string;
  operation: string;
  tokensIn: number | null;
  tokensOut: number | null;
  costEstimate: number | null;
  latencyMs: number;
  status: "succeeded" | "failed";
  errorClass: string | null;
}

// AI-RULES.md §1/§2.4: every call writes one row, tokens/cost/latency/status/
// error_class only - never prompts, never outputs. Nothing in this function's
// parameters carries content, by construction.
export async function recordAiUsage(record: AiUsageRecord): Promise<void> {
  await pool.query(
    `INSERT INTO ai_usage
       (user_id, job_id, provider, model, operation, tokens_in, tokens_out, cost_estimate, latency_ms, status, error_class)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)`,
    [
      record.userId,
      record.jobId,
      record.provider,
      record.model,
      record.operation,
      record.tokensIn,
      record.tokensOut,
      record.costEstimate,
      record.latencyMs,
      record.status,
      record.errorClass,
    ],
  );
}

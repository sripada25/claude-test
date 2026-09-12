import { getAIProvider, getAIProviderMetadata } from "../ai/provider.ts";
import { pool } from "../db.ts";
import { insertApplicationEvent } from "../repositories/application-event.ts";
import { recordAiUsage } from "../repositories/ai-usage.ts";
import { touchApplicationActivity } from "../repositories/application.ts";
import type { CallNoteInput, StructuredNote } from "../ai/types.ts";
import { getApplication } from "./application.ts";
import { createCustomReminder } from "./reminder.ts";

export type StructureCallResult =
  | { success: true; note: StructuredNote }
  | { success: false; reason: "not_found" | "ai_failed" };

// F5-1: never consumes generation quota (AI-RULES.md section 6.1) - same
// non-metered category as draftFollowUp. Persists nothing; the caller
// reviews/edits the result and only logCall writes anything.
export async function structureCall(
  userId: string,
  applicationId: string,
  input: CallNoteInput,
): Promise<StructureCallResult> {
  const application = await getApplication(userId, applicationId);
  if (!application) {
    return { success: false, reason: "not_found" };
  }

  const provider = getAIProvider();
  const { provider: providerName, model } = getAIProviderMetadata();

  const startedAt = Date.now();
  const result = await provider.structureCallNote(input);
  const latencyMs = Date.now() - startedAt;

  if (!result.success) {
    await recordAiUsage({
      userId,
      jobId: null,
      provider: providerName,
      model,
      operation: "structure_call_note",
      tokensIn: null,
      tokensOut: null,
      costEstimate: null,
      latencyMs,
      status: "failed",
      errorClass: result.error.errorClass,
    });
    return { success: false, reason: "ai_failed" };
  }

  await recordAiUsage({
    userId,
    jobId: null,
    provider: providerName,
    model,
    operation: "structure_call_note",
    tokensIn: null,
    tokensOut: null,
    costEstimate: null,
    latencyMs,
    status: "succeeded",
    errorClass: null,
  });

  return { success: true, note: result.data };
}

export interface LogCallInput {
  question1Answer: string;
  question2Answer: string;
  question3Answer: string;
  structured?: StructuredNote;
}

export type LogCallResult = { success: true } | { success: false; reason: "not_found" | "invalid_input" };

function truncate(text: string, max: number): string {
  return text.length > max ? `${text.slice(0, max - 1)}…` : text;
}

// F5-1: one application_events row (type='call_logged') plus the
// last_activity_at bump the schema's own invariant requires
// (DATABASE_quarterfinal.md section 3.1) - both in one transaction, since
// together they represent one fact: "the call log was recorded." The
// reminder side effect is deliberately outside that transaction - it's
// explicitly best-effort (a blocked upsert because one is already active
// is a no-op, not a failure), reusing createCustomReminder (F4-3.6)
// exactly as built rather than duplicating its ownership/validation/upsert
// logic here.
export async function logCall(
  userId: string,
  applicationId: string,
  input: LogCallInput,
): Promise<LogCallResult> {
  const application = await getApplication(userId, applicationId);
  if (!application) {
    return { success: false, reason: "not_found" };
  }

  if (!input.question1Answer.trim() || !input.question2Answer.trim() || !input.question3Answer.trim()) {
    return { success: false, reason: "invalid_input" };
  }

  const description = input.structured ? input.structured.summary : `Call logged: ${truncate(input.question2Answer, 80)}`;

  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    await insertApplicationEvent(client, {
      applicationId,
      userId,
      type: "call_logged",
      description,
      metadata: {
        question1Answer: input.question1Answer,
        question2Answer: input.question2Answer,
        question3Answer: input.question3Answer,
        structured: input.structured ?? null,
      },
    });
    await touchApplicationActivity(client, applicationId);
    await client.query("COMMIT");
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }

  if (input.structured?.followUpDate) {
    const dueAt = new Date(input.structured.followUpDate);
    if (!Number.isNaN(dueAt.getTime())) {
      await createCustomReminder(userId, applicationId, dueAt);
    }
  }

  return { success: true };
}

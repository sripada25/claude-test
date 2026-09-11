import { getAIProvider, getAIProviderMetadata } from "../ai/provider.ts";
import { recordAiUsage } from "../repositories/ai-usage.ts";
import {
  findPendingRemindersForUser,
  findReminderForUser,
  updateReminderDraft,
  type ReminderQueueRow,
} from "../repositories/reminder.ts";

export interface ReminderQueueItem {
  id: string;
  type: ReminderQueueRow["type"];
  dueAt: string;
  applicationId: string;
  company: string;
  role: string;
  dateApplied: string | null;
  interviewAt: string | null;
}

export interface ReminderQueue {
  dueNow: ReminderQueueItem[];
  upcoming: ReminderQueueItem[];
}

function toQueueItem(row: ReminderQueueRow): ReminderQueueItem {
  return {
    id: row.id,
    type: row.type,
    dueAt: row.dueAt.toISOString(),
    applicationId: row.applicationId,
    company: row.company,
    role: row.role,
    dateApplied: row.dateApplied,
    interviewAt: row.interviewAt ? row.interviewAt.toISOString() : null,
  };
}

// "Due now" vs "upcoming" is a business rule (CLAUDE.md section 4), so it's
// decided here, not in the repository's SQL. In practice "upcoming" only
// ever holds same-day reminders not quite due yet - R1's due_at is always
// today at 9am local when inserted (F4-2.1), R2's is interview_at + 24h
// inserted within a one-hour window around that threshold - so nothing here
// is ever far in the future; no separate lookahead cap is needed.
export async function getReminderQueue(userId: string): Promise<ReminderQueue> {
  const rows = await findPendingRemindersForUser(userId);
  const now = Date.now();

  const dueNow: ReminderQueueItem[] = [];
  const upcoming: ReminderQueueItem[] = [];

  for (const row of rows) {
    const item = toQueueItem(row);
    if (row.dueAt.getTime() <= now) {
      dueNow.push(item);
    } else {
      upcoming.push(item);
    }
  }

  return { dueNow, upcoming };
}

export type DraftReminderResult =
  | { success: true; draftContent: string }
  | { success: false; reason: "not_found" | "ai_failed" };

// F4-TASKS.md section 6: daysSinceApplied is flavor text for R1's prompt, not
// a security-sensitive calculation - a plain day-difference is correct here,
// unlike F4-2.1's scheduler which needs per-user-timezone precision to decide
// whether a reminder fires at all.
function daysSinceApplied(dateApplied: string | null): number | undefined {
  if (!dateApplied) {
    return undefined;
  }
  const elapsedMs = Date.now() - new Date(dateApplied).getTime();
  return Math.max(0, Math.floor(elapsedMs / (24 * 60 * 60 * 1000)));
}

// F4-2.4: "generated once, then editable" (the schema's own comment on
// draft_content) - an existing draft is returned as-is, no new Gemini call,
// no new ai_usage row. Never consumes/refunds generation quota (L055) - this
// isn't a documents.generations_used-metered operation.
export async function draftReminderFollowUp(userId: string, reminderId: string): Promise<DraftReminderResult> {
  const reminder = await findReminderForUser(reminderId, userId);
  if (!reminder) {
    return { success: false, reason: "not_found" };
  }

  if (reminder.draftContent !== null) {
    return { success: true, draftContent: reminder.draftContent };
  }

  const provider = getAIProvider();
  const { provider: providerName, model } = getAIProviderMetadata();

  const startedAt = Date.now();
  const result = await provider.draftFollowUp({
    type: reminder.type,
    companyName: reminder.company,
    roleTitle: reminder.role,
    daysSinceApplied: daysSinceApplied(reminder.dateApplied),
  });
  const latencyMs = Date.now() - startedAt;

  if (!result.success) {
    await recordAiUsage({
      userId,
      jobId: null,
      provider: providerName,
      model,
      operation: "draft_follow_up",
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
    operation: "draft_follow_up",
    tokensIn: null,
    tokensOut: null,
    costEstimate: null,
    latencyMs,
    status: "succeeded",
    errorClass: null,
  });

  await updateReminderDraft(reminderId, result.data);
  return { success: true, draftContent: result.data };
}

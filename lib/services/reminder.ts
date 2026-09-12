import { getAIProvider, getAIProviderMetadata } from "../ai/provider.ts";
import { pool } from "../db.ts";
import { insertApplicationEvent } from "../repositories/application-event.ts";
import { recordAiUsage } from "../repositories/ai-usage.ts";
import { countSentToday, insertEmailLog } from "../repositories/email-log.ts";
import { sendEmail } from "../email/transport.ts";
import {
  dismissReminder,
  findPendingRemindersForUser,
  findRemindersByApplication,
  findReminderForSend,
  findReminderForUser,
  findResolvedRemindersForUser,
  markReminderSent,
  setApplicationFollowUpSnoozedUntil,
  snoozeReminder,
  updateReminderDraft,
  upsertCustomFollowupReminder,
  type ApplicationReminder,
  type ReminderQueueRow,
} from "../repositories/reminder.ts";
import { getApplication } from "./application.ts";
import { getSubscription } from "./subscription.ts";
import { DAILY_SEND_THRESHOLD } from "./reminder-notifier.ts";

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
  done: ReminderQueueItem[];
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
  const [rows, resolvedRows] = await Promise.all([
    findPendingRemindersForUser(userId),
    findResolvedRemindersForUser(userId),
  ]);
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

  const done = resolvedRows.map(toQueueItem);

  return { dueNow, upcoming, done };
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

  await updateReminderDraft(reminderId, userId, result.data);
  return { success: true, draftContent: result.data };
}

export type PatchReminderResult =
  | { success: true; id: string; status: "snoozed" | "dismissed"; snoozedUntil: string | null; dismissedAt: string | null }
  | { success: false; reason: "not_found" };

// F4-2.5: writes reminders + applications together, in one transaction -
// same pool.connect()/BEGIN/COMMIT/ROLLBACK shape as
// generation-worker.ts's job-success path. applications.follow_up_snoozed_until
// is written from snoozeReminder's own returned applicationId, never from
// client input, so no separate ownership check is needed on that write.
export async function snoozeReminderFollowUp(
  userId: string,
  reminderId: string,
  until: Date,
): Promise<PatchReminderResult> {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const snoozed = await snoozeReminder(client, reminderId, userId, until);
    if (!snoozed) {
      await client.query("ROLLBACK");
      return { success: false, reason: "not_found" };
    }
    await setApplicationFollowUpSnoozedUntil(client, snoozed.applicationId, until);
    await client.query("COMMIT");
    return {
      success: true,
      id: snoozed.id,
      status: "snoozed",
      snoozedUntil: snoozed.snoozedUntil.toISOString(),
      dismissedAt: null,
    };
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

// Single-table write - no applications touch, no application_events row
// (see the repository comment on dismissReminder for why).
export async function dismissReminderFollowUp(userId: string, reminderId: string): Promise<PatchReminderResult> {
  const dismissed = await dismissReminder(reminderId, userId);
  if (!dismissed) {
    return { success: false, reason: "not_found" };
  }
  return {
    success: true,
    id: dismissed.id,
    status: "dismissed",
    snoozedUntil: null,
    dismissedAt: dismissed.dismissedAt.toISOString(),
  };
}

export type MarkReminderSentResult =
  | { success: true; id: string; status: "sent"; sentAt: string }
  | { success: false; reason: "not_found" };

// F4-2.6: one action, two consequences (F4-TASKS.md section 4) - the
// reminder closes and the board's Follow up tag clears, since its
// derived-tag query (section 2) checks for exactly this application_events
// row. Both writes share one transaction; the event's applicationId comes
// only from markReminderSent's own returned row, never from client input.
// No applications write here - see the repository comment on why that's
// correct, not an omission.
export async function markReminderFollowUpSent(userId: string, reminderId: string): Promise<MarkReminderSentResult> {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const sent = await markReminderSent(client, reminderId, userId);
    if (!sent) {
      await client.query("ROLLBACK");
      return { success: false, reason: "not_found" };
    }
    await insertApplicationEvent(client, {
      applicationId: sent.applicationId,
      userId,
      type: "follow_up_sent",
      description: "Follow-up email sent",
    });
    await client.query("COMMIT");
    return { success: true, id: sent.id, status: "sent", sentAt: sent.sentAt.toISOString() };
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

export type SendReminderFollowUpResult =
  | { success: true; id: string; status: "sent"; sentAt: string; recipientEmail: string }
  | {
      success: false;
      reason: "not_found" | "not_pro" | "no_recipient" | "contact_email_unverified" | "quota_exceeded" | "send_failed";
    };

// M08-R2: wraps markReminderFollowUpSent rather than duplicating its writes -
// the DB outcome of a real send and today's mark-as-sent placeholder is
// identical (status -> sent, one follow_up_sent event). sendEmail() runs
// BEFORE that write, outside any transaction, so a failed send never marks
// the reminder resolved - the user can retry (08d's "Retry send").
export async function sendReminderFollowUp(
  userId: string,
  reminderId: string,
  subject: string,
): Promise<SendReminderFollowUpResult> {
  const subscription = await getSubscription(userId);
  if (subscription.tier !== "pro") {
    return { success: false, reason: "not_pro" };
  }

  const reminder = await findReminderForSend(reminderId, userId);
  if (!reminder || reminder.draftContent === null) {
    return { success: false, reason: "not_found" };
  }
  if (!reminder.recipientEmail) {
    return { success: false, reason: "no_recipient" };
  }
  if (!reminder.senderContactEmail || !reminder.senderContactEmailVerified) {
    return { success: false, reason: "contact_email_unverified" };
  }

  if ((await countSentToday()) >= DAILY_SEND_THRESHOLD) {
    return { success: false, reason: "quota_exceeded" };
  }

  try {
    await sendEmail({
      to: reminder.recipientEmail,
      subject,
      text: reminder.draftContent,
      replyTo: reminder.senderContactEmail,
    });
  } catch (error) {
    await insertEmailLog({
      userId,
      recipient: reminder.recipientEmail,
      purpose: "follow_up_manual_send",
      sentAt: null,
      failedAt: new Date(),
      error: error instanceof Error ? error.message : String(error),
    });
    return { success: false, reason: "send_failed" };
  }

  await insertEmailLog({
    userId,
    recipient: reminder.recipientEmail,
    purpose: "follow_up_manual_send",
    sentAt: new Date(),
    failedAt: null,
    error: null,
  });

  const marked = await markReminderFollowUpSent(userId, reminderId);
  if (!marked.success) {
    return { success: false, reason: "not_found" };
  }

  return { success: true, id: marked.id, status: "sent", sentAt: marked.sentAt, recipientEmail: reminder.recipientEmail };
}

export type UpdateReminderDraftResult =
  | { success: true; draftContent: string }
  | { success: false; reason: "not_found" | "empty_content" };

// F4-3.2: no AI-output validation beyond non-empty - once a human has
// edited it, AI-RULES.md section 2.3's "never save model output unchecked"
// no longer applies, same reasoning updateDocumentContent already
// documents for the analogous document-editing case.
export async function updateReminderDraftContent(
  userId: string,
  reminderId: string,
  content: string,
): Promise<UpdateReminderDraftResult> {
  if (content.trim() === "") {
    return { success: false, reason: "empty_content" };
  }

  const updated = await updateReminderDraft(reminderId, userId, content);
  if (!updated) {
    return { success: false, reason: "not_found" };
  }

  return { success: true, draftContent: updated.draftContent };
}

export type ListRemindersResult =
  | { success: true; reminders: ApplicationReminder[] }
  | { success: false; reason: "not_found" };

// F4-3.5: populates M05's Reminders tab. Ownership is enforced via the
// existing application lookup, same convention as listDocuments - a user
// can never list another user's reminders by guessing an applicationId.
export async function listReminders(userId: string, applicationId: string): Promise<ListRemindersResult> {
  const application = await getApplication(userId, applicationId);
  if (!application) {
    return { success: false, reason: "not_found" };
  }

  const reminders = await findRemindersByApplication(applicationId);
  return { success: true, reminders };
}

export type CreateCustomReminderResult =
  | { success: true; id: string; status: "pending"; dueAt: string }
  | { success: false; reason: "not_found" | "invalid_due_at" | "already_active" };

// F4-3.6: "Set a reminder" - reuses the application_followup type (see the
// repository comment on upsertCustomFollowupReminder for why), so the
// created row is indistinguishable from a system-generated one everywhere
// else in F4: it shows in the queue, drafts via the existing R1 prompt,
// and can be snoozed/dismissed/marked sent with no special-casing.
export async function createCustomReminder(
  userId: string,
  applicationId: string,
  dueAt: Date,
): Promise<CreateCustomReminderResult> {
  const application = await getApplication(userId, applicationId);
  if (!application) {
    return { success: false, reason: "not_found" };
  }

  if (Number.isNaN(dueAt.getTime()) || dueAt.getTime() <= Date.now()) {
    return { success: false, reason: "invalid_due_at" };
  }

  const upserted = await upsertCustomFollowupReminder(userId, applicationId, dueAt);
  if (!upserted) {
    return { success: false, reason: "already_active" };
  }

  return { success: true, id: upserted.id, status: "pending", dueAt: upserted.dueAt.toISOString() };
}

import { sendEmail } from "../email/transport.ts";
import { countSentToday, insertEmailLog } from "../repositories/email-log.ts";
import {
  findDueUnnotifiedReminders,
  markReminderNotified,
  type DueNotificationCandidate,
} from "../repositories/reminder.ts";

const TICK_INTERVAL_MS = 60 * 1000;
const BATCH_SIZE = 5;

// Brevo's free tier caps at 300/day (COST-MODEL.md section 4.3). Reminders
// are the dominant volume driver there (~85% of total email volume during a
// trial period) - reserving 50/day headroom keeps verification and
// password-reset emails, which must never fail to send, from being crowded
// out by a reminder cluster.
// Exported so M08-R2's manual "Send now" checks against the same shared
// budget - one daily cap across every purpose, not a per-feature quota.
export const DAILY_SEND_THRESHOLD = 250;

function buildNotificationEmail(candidate: DueNotificationCandidate): { subject: string; text: string } {
  if (candidate.type === "post_interview") {
    return {
      subject: `Time to send your thank-you: ${candidate.company} — ${candidate.role}`,
      text: `Your interview for ${candidate.role} at ${candidate.company} was 24 hours ago. Open Trackr to draft and send a thank-you note.`,
    };
  }
  return {
    subject: `Time to follow up: ${candidate.company} — ${candidate.role}`,
    text: `It's been a week since you applied to ${candidate.role} at ${candidate.company}. Open Trackr to draft and send your follow-up.`,
  };
}

export async function runNotificationTick(): Promise<{ sent: number; optedOut: number; deferred: number }> {
  const candidates = await findDueUnnotifiedReminders(BATCH_SIZE);
  if (candidates.length === 0) {
    return { sent: 0, optedOut: 0, deferred: 0 };
  }

  let sentToday = await countSentToday();
  let sent = 0;
  let optedOut = 0;
  let deferred = 0;

  for (const candidate of candidates) {
    if (!candidate.reminderEmailsEnabled) {
      await markReminderNotified(candidate.reminderId);
      optedOut += 1;
      continue;
    }

    if (sentToday >= DAILY_SEND_THRESHOLD) {
      deferred += 1;
      continue;
    }

    const { subject, text } = buildNotificationEmail(candidate);
    try {
      await sendEmail({ to: candidate.email, subject, text });
      await insertEmailLog({
        userId: candidate.userId,
        recipient: candidate.email,
        purpose: "reminder_due",
        sentAt: new Date(),
        failedAt: null,
        error: null,
      });
      await markReminderNotified(candidate.reminderId);
      sentToday += 1;
      sent += 1;
    } catch (error) {
      await insertEmailLog({
        userId: candidate.userId,
        recipient: candidate.email,
        purpose: "reminder_due",
        sentAt: null,
        failedAt: new Date(),
        error: error instanceof Error ? error.message : String(error),
      });
      deferred += 1;
    }
  }

  return { sent, optedOut, deferred };
}

let notifierTimer: ReturnType<typeof setTimeout> | null = null;

export function startReminderNotifier(): void {
  if (notifierTimer) {
    return;
  }

  const tick = async () => {
    try {
      await runNotificationTick();
    } catch (error) {
      console.error("[reminder-notifier] tick failed:", error instanceof Error ? error.message : error);
    } finally {
      notifierTimer = setTimeout(tick, TICK_INTERVAL_MS);
    }
  };

  notifierTimer = setTimeout(tick, TICK_INTERVAL_MS);
}

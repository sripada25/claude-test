import {
  findApplicationFollowupCandidates,
  insertPostInterviewReminders,
  insertReminder,
} from "../repositories/reminder.ts";
import { localDateString, zonedTimeToUtc } from "./reminder-time.ts";

const TICK_INTERVAL_MS = 60 * 60 * 1000;
const R1_WINDOW_DAYS = 7; // L121: fixed, not configurable, for MVP
const R1_REMINDER_HOUR = 9; // "9am local" (L041) - never UTC, never the server's own timezone

export async function runReminderSweep(): Promise<{ r1Inserted: number; r2Inserted: number }> {
  let r1Inserted = 0;

  const candidates = await findApplicationFollowupCandidates();
  for (const candidate of candidates) {
    const sevenDaysAgoLocal = localDateString(candidate.timezone, R1_WINDOW_DAYS);
    if (sevenDaysAgoLocal !== candidate.dateApplied) {
      continue;
    }

    const todayLocal = localDateString(candidate.timezone, 0);
    const [year, month, day] = todayLocal.split("-").map(Number);
    const dueAt = zonedTimeToUtc(year, month, day, R1_REMINDER_HOUR, candidate.timezone);

    const inserted = await insertReminder({
      userId: candidate.userId,
      applicationId: candidate.applicationId,
      type: "application_followup",
      dueAt,
    });
    if (inserted) {
      r1Inserted += 1;
    }
  }

  const r2Inserted = await insertPostInterviewReminders();

  return { r1Inserted, r2Inserted };
}

let schedulerTimer: ReturnType<typeof setTimeout> | null = null;

export function startReminderScheduler(): void {
  if (schedulerTimer) {
    return;
  }

  const tick = async () => {
    try {
      await runReminderSweep();
    } catch (error) {
      console.error("[reminder-scheduler] tick failed:", error instanceof Error ? error.message : error);
    } finally {
      schedulerTimer = setTimeout(tick, TICK_INTERVAL_MS);
    }
  };

  schedulerTimer = setTimeout(tick, TICK_INTERVAL_MS);
}

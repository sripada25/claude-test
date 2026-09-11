// F3-2.4: starts the in-process generation-job worker once when the server
// boots. NEXT_RUNTIME guards against the edge runtime, which also calls
// register() but can't hold a pg Pool or a long-lived setTimeout.
export async function register(): Promise<void> {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    const { startGenerationWorker } = await import("@/lib/services/generation-worker");
    startGenerationWorker();

    // F4-2.1: the reminder scheduler - same in-process pattern, its own
    // independent hourly timer, no separate service (L030, L089).
    const { startReminderScheduler } = await import("@/lib/services/reminder-scheduler");
    startReminderScheduler();

    // F4-2.2: notifies the user when a reminder becomes due - its own
    // independent per-minute timer, distinct from F4-2.1's hourly insert.
    const { startReminderNotifier } = await import("@/lib/services/reminder-notifier");
    startReminderNotifier();
  }
}

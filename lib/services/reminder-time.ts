// Pure timezone arithmetic for the reminder scheduler (F4-2.1), split out
// from reminder-scheduler.ts so it can be unit-tested without pulling in
// lib/db.ts's pool (which requires DATABASE_URL at module load time).

// Returns "today minus `daysAgo`" as YYYY-MM-DD in `timezone`'s own calendar,
// matching applications.date_applied's plain-DATE (no time component)
// representation. Pure UTC-anchored day arithmetic once the timezone-local
// y/m/d is known, so this is immune to DST - there's no time-of-day involved.
export function localDateString(timezone: string, daysAgo: number, now: Date = new Date()): string {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: timezone,
    year: "numeric",
    month: "numeric",
    day: "numeric",
  }).formatToParts(now);
  const year = Number(parts.find((part) => part.type === "year")?.value);
  const month = Number(parts.find((part) => part.type === "month")?.value);
  const day = Number(parts.find((part) => part.type === "day")?.value);
  const utcMidnight = Date.UTC(year, month - 1, day);
  const shifted = new Date(utcMidnight - daysAgo * 24 * 60 * 60 * 1000);
  return shifted.toISOString().slice(0, 10);
}

// Reverses an Intl.DateTimeFormat read: given a wall-clock y/m/d + hour meant
// to be understood in `timezone`, returns the UTC instant it corresponds to.
// Guess (treat the wall-clock value as if it were UTC), measure what that
// guess actually reads as in the target timezone, then correct by the
// difference - one pass, exact except within the rare window of an actual
// DST transition, the same precision already accepted for computeResetDate.
export function zonedTimeToUtc(year: number, month: number, day: number, hour: number, timezone: string): Date {
  const utcGuess = new Date(Date.UTC(year, month - 1, day, hour, 0, 0));
  const formatter = new Intl.DateTimeFormat("en-US", {
    timeZone: timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  });
  const parts = formatter.formatToParts(utcGuess);
  const get = (type: string) => Number(parts.find((part) => part.type === type)?.value);
  const readHour = get("hour") % 24;
  const readAsUtc = Date.UTC(get("year"), get("month") - 1, get("day"), readHour, get("minute"), get("second"));
  const diffMs = readAsUtc - utcGuess.getTime();
  return new Date(utcGuess.getTime() - diffMs);
}

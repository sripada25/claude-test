import { describe, expect, it } from "vitest";
import { localDateString, zonedTimeToUtc } from "./reminder-time.ts";

describe("localDateString", () => {
  it("returns today's date in a UTC-aligned timezone with no offset", () => {
    const now = new Date("2026-01-05T12:00:00.000Z");
    expect(localDateString("UTC", 0, now)).toBe("2026-01-05");
  });

  it("subtracts whole days across a month/year boundary", () => {
    const now = new Date("2026-01-05T12:00:00.000Z");
    expect(localDateString("UTC", 7, now)).toBe("2025-12-29");
  });

  it("uses the timezone's own local calendar day, not UTC's, near a date-line crossing", () => {
    // 2026-01-01T23:00:00Z in Pacific/Kiritimati (UTC+14, no DST) is already
    // 2026-01-02T13:00 local - a full calendar day ahead of UTC's own date.
    // This is exactly the class of bug L041 exists to prevent.
    const now = new Date("2026-01-01T23:00:00.000Z");
    expect(localDateString("Pacific/Kiritimati", 0, now)).toBe("2026-01-02");
    expect(localDateString("UTC", 0, now)).toBe("2026-01-01");
  });

  it("uses the timezone's own local calendar day on the other side of the date line", () => {
    // 2026-01-01T00:30:00Z in Pacific/Niue (UTC-11, no DST) is still
    // 2025-12-31T13:30 local - a full calendar day behind UTC's own date.
    const now = new Date("2026-01-01T00:30:00.000Z");
    expect(localDateString("Pacific/Niue", 0, now)).toBe("2025-12-31");
    expect(localDateString("UTC", 0, now)).toBe("2026-01-01");
  });
});

describe("zonedTimeToUtc", () => {
  it("converts 9am in a half-hour-offset timezone (Asia/Kolkata, UTC+5:30) to the correct UTC instant", () => {
    const result = zonedTimeToUtc(2026, 6, 15, 9, "Asia/Kolkata");
    expect(result.toISOString()).toBe("2026-06-15T03:30:00.000Z");
  });

  it("converts 9am in a negative-offset timezone during standard time (America/New_York, UTC-5)", () => {
    const result = zonedTimeToUtc(2026, 1, 15, 9, "America/New_York");
    expect(result.toISOString()).toBe("2026-01-15T14:00:00.000Z");
  });

  it("converts 9am in the same timezone during daylight time (America/New_York, UTC-4)", () => {
    const result = zonedTimeToUtc(2026, 7, 15, 9, "America/New_York");
    expect(result.toISOString()).toBe("2026-07-15T13:00:00.000Z");
  });

  it("rolls the UTC calendar day backward for an extreme positive offset (Pacific/Kiritimati, UTC+14)", () => {
    const result = zonedTimeToUtc(2026, 6, 15, 9, "Pacific/Kiritimati");
    expect(result.toISOString()).toBe("2026-06-14T19:00:00.000Z");
  });

  it("round-trips: formatting the result back in the same timezone reads back 9am", () => {
    const result = zonedTimeToUtc(2026, 3, 10, 9, "America/New_York");
    const formatter = new Intl.DateTimeFormat("en-US", {
      timeZone: "America/New_York",
      hour: "2-digit",
      hour12: false,
    });
    expect(formatter.format(result)).toMatch(/09|9/);
  });
});

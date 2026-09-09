import { pool } from "../db.ts";
import {
  findEmploymentHistoryByUserId,
  replaceEmploymentHistory,
  type EmploymentEntry,
} from "../repositories/employment-history.ts";

const MAX_ENTRIES = 20;
const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

export interface EmploymentEntryInput {
  employer: string;
  title: string;
  startDate: string;
  endDate: string | null;
}

export type ReplaceEmploymentHistoryResult =
  | { success: true; entries: EmploymentEntry[] }
  | { success: false; reason: "too_many_entries" | "invalid_entry" };

export function listEmploymentHistory(userId: string): Promise<EmploymentEntry[]> {
  return findEmploymentHistoryByUserId(userId);
}

function isValidEntry(entry: EmploymentEntryInput): boolean {
  if (!entry.employer.trim() || !entry.title.trim()) {
    return false;
  }
  if (!DATE_PATTERN.test(entry.startDate)) {
    return false;
  }
  if (entry.endDate !== null) {
    if (!DATE_PATTERN.test(entry.endDate)) {
      return false;
    }
    if (entry.endDate < entry.startDate) {
      return false;
    }
  }
  return true;
}

// Validated here, before the query, so a bad request gets a clean 400
// rather than a raw CHECK-constraint violation from the database.
export async function replaceEmploymentHistoryForUser(
  userId: string,
  entries: EmploymentEntryInput[],
): Promise<ReplaceEmploymentHistoryResult> {
  if (entries.length > MAX_ENTRIES) {
    return { success: false, reason: "too_many_entries" };
  }
  if (!entries.every(isValidEntry)) {
    return { success: false, reason: "invalid_entry" };
  }

  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const result = await replaceEmploymentHistory(
      client,
      userId,
      entries.map((entry) => ({
        employer: entry.employer.trim(),
        title: entry.title.trim(),
        startDate: entry.startDate,
        endDate: entry.endDate,
      })),
    );
    await client.query("COMMIT");
    return { success: true, entries: result };
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  } finally {
    client.release();
  }
}

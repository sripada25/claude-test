import { pool, type Queryable } from "../db.ts";

export interface EmploymentEntry {
  id: string;
  employer: string;
  title: string;
  startDate: string;
  endDate: string | null;
}

interface EmploymentEntryRow {
  id: string;
  employer: string;
  title: string;
  start_date: string;
  end_date: string | null;
}

function toEmploymentEntry(row: EmploymentEntryRow): EmploymentEntry {
  return {
    id: row.id,
    employer: row.employer,
    title: row.title,
    startDate: row.start_date,
    endDate: row.end_date,
  };
}

export async function findEmploymentHistoryByUserId(userId: string): Promise<EmploymentEntry[]> {
  const result = await pool.query<EmploymentEntryRow>(
    `SELECT id, employer, title, start_date, end_date
     FROM employment_history
     WHERE user_id = $1
     ORDER BY start_date DESC`,
    [userId],
  );
  return result.rows.map(toEmploymentEntry);
}

// Whole-list replace, not per-entry diffing - matches how `skills` (a
// TEXT[] on profiles) already works: the client submits its full local
// list, the server replaces wholesale. Caller wraps this in a transaction.
export async function replaceEmploymentHistory(
  db: Queryable,
  userId: string,
  entries: { employer: string; title: string; startDate: string; endDate: string | null }[],
): Promise<EmploymentEntry[]> {
  await db.query(`DELETE FROM employment_history WHERE user_id = $1`, [userId]);

  const inserted: EmploymentEntry[] = [];
  for (const entry of entries) {
    const result = await db.query<EmploymentEntryRow>(
      `INSERT INTO employment_history (user_id, employer, title, start_date, end_date)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING id, employer, title, start_date, end_date`,
      [userId, entry.employer, entry.title, entry.startDate, entry.endDate],
    );
    inserted.push(toEmploymentEntry(result.rows[0]));
  }
  return inserted;
}

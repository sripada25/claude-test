import type { Queryable } from "../db.ts";

// L090's copy-on-write: NULL jd_snapshot means "same as the application's
// current JD," so a document relying on that must get the *old* JD copied
// in before the application's JD actually changes underneath it. Defensive
// under the current design - the F3-2.4 worker always sets jd_snapshot
// explicitly, so no document should ever be NULL here today - kept as a
// safety net for any future document-creation path that doesn't.
export async function copyJobDescriptionToSnapshotlessDocuments(
  db: Queryable,
  applicationId: string,
  oldJobDescription: string | null,
): Promise<void> {
  await db.query(`UPDATE documents SET jd_snapshot = $2 WHERE application_id = $1 AND jd_snapshot IS NULL`, [
    applicationId,
    oldJobDescription,
  ]);
}

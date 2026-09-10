import { pool, type Queryable } from "../db.ts";

export type DocumentType = "cover_letter" | "resume";

export interface GeneratedDocument {
  id: string;
  type: DocumentType;
  content: string;
  createdAt: Date;
}

interface DocumentRow {
  id: string;
  type: DocumentType;
  content: string;
  created_at: Date;
}

// F3-3.2: links a succeeded job to the document it produced, so the status
// poll can return the actual content. Bare UUID, no FK - same style as
// ai_usage.job_id.
export async function findDocumentByJobId(jobId: string): Promise<GeneratedDocument | null> {
  const result = await pool.query<DocumentRow>(
    `SELECT id, type, content, created_at FROM documents WHERE job_id = $1`,
    [jobId],
  );
  if (!result.rows[0]) {
    return null;
  }
  return {
    id: result.rows[0].id,
    type: result.rows[0].type,
    content: result.rows[0].content,
    createdAt: result.rows[0].created_at,
  };
}

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

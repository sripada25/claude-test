import type { Queryable } from "../db.ts";

export type ApplicationEventType =
  | "created"
  | "status_changed"
  | "document_generated"
  | "call_logged"
  | "follow_up_sent"
  | "reminder_set"
  | "note_updated";

export interface ApplicationEvent {
  id: string;
  applicationId: string;
  userId: string;
  type: ApplicationEventType;
  description: string;
  metadata: Record<string, unknown>;
  createdAt: Date;
}

interface ApplicationEventRow {
  id: string;
  application_id: string;
  user_id: string;
  type: ApplicationEventType;
  description: string;
  metadata: Record<string, unknown>;
  created_at: Date;
}

function toApplicationEvent(row: ApplicationEventRow): ApplicationEvent {
  return {
    id: row.id,
    applicationId: row.application_id,
    userId: row.user_id,
    type: row.type,
    description: row.description,
    metadata: row.metadata,
    createdAt: row.created_at,
  };
}

// Append-only by construction - there is deliberately no update or delete
// function in this module.
export async function insertApplicationEvent(
  db: Queryable,
  input: {
    applicationId: string;
    userId: string;
    type: ApplicationEventType;
    description: string;
    metadata?: Record<string, unknown>;
  },
): Promise<ApplicationEvent> {
  const result = await db.query<ApplicationEventRow>(
    `INSERT INTO application_events (application_id, user_id, type, description, metadata)
     VALUES ($1, $2, $3, $4, $5)
     RETURNING id, application_id, user_id, type, description, metadata, created_at`,
    [
      input.applicationId,
      input.userId,
      input.type,
      input.description,
      JSON.stringify(input.metadata ?? {}),
    ],
  );
  return toApplicationEvent(result.rows[0]);
}

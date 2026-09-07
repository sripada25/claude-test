import { pool } from "../db.ts";
import {
  insertApplicationEvent,
  type ApplicationEvent,
  type ApplicationEventType,
} from "../repositories/application-event.ts";

const VALID_EVENT_TYPES: ApplicationEventType[] = [
  "created",
  "status_changed",
  "document_generated",
  "call_logged",
  "follow_up_sent",
  "reminder_set",
  "note_updated",
];

export interface RecordEventInput {
  applicationId: string;
  userId: string;
  type: ApplicationEventType;
  description: string;
  metadata?: Record<string, unknown>;
}

export type RecordEventResult =
  | { success: true; event: ApplicationEvent }
  | { success: false; reason: "invalid_type" | "empty_description" };

// The one path every application state change writes through - F2-2.4's
// PATCH and the board drag call this same function, and F3/F4/M05 features
// will as they land. Always writes exactly one row per call; there is no
// server-side debounce/coalescing since application_events is append-only.
// Not calling this too often is the caller's job.
export async function recordApplicationEvent(input: RecordEventInput): Promise<RecordEventResult> {
  if (!VALID_EVENT_TYPES.includes(input.type)) {
    return { success: false, reason: "invalid_type" };
  }
  if (!input.description.trim()) {
    return { success: false, reason: "empty_description" };
  }

  const event = await insertApplicationEvent(pool, input);
  return { success: true, event };
}

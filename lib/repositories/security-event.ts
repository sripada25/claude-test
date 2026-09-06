import { pool } from "../db.ts";

export async function insertSecurityEvent(params: {
  eventType: string;
  userId: string | null;
  ip: string | null;
  userAgent: string | null;
  metadata: Record<string, unknown>;
}): Promise<void> {
  await pool.query(
    `INSERT INTO security_events (event_type, user_id, ip, user_agent, metadata)
     VALUES ($1, $2, $3, $4, $5)`,
    [
      params.eventType,
      params.userId,
      params.ip,
      params.userAgent,
      JSON.stringify(params.metadata),
    ],
  );
}

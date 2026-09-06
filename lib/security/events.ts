import { insertSecurityEvent } from "../repositories/security-event.ts";

export type SecurityEventType =
  | "login_failed"
  | "login_success"
  | "rate_limit_tripped"
  | "otp_failed"
  | "otp_locked"
  | "password_invalidated_by_oauth_link"
  | "email_changed"
  | "oauth_linked"
  | "oauth_unlinked"
  | "oauth_state_mismatch"
  | "permission_denied"
  | "session_resolution_failed";

export async function logSecurityEvent(
  eventType: SecurityEventType,
  details: {
    userId?: string;
    ip?: string;
    userAgent?: string;
    metadata?: Record<string, unknown>;
  } = {},
): Promise<void> {
  try {
    await insertSecurityEvent({
      eventType,
      userId: details.userId ?? null,
      ip: details.ip ?? null,
      userAgent: details.userAgent ?? null,
      metadata: details.metadata ?? {},
    });
  } catch (err) {
    // Deliberate: a logging failure must never propagate. Callers in the
    // fail-closed path (T2.3) rely on this call never throwing, so a DB
    // outage here can't mask or block the deny it's trying to record.
    console.error("Failed to write security event", eventType, err);
  }
}

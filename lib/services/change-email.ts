import { sendEmail } from "../email/transport.ts";
import { findUserByEmail, updateEmail } from "../repositories/user.ts";
import { checkRateLimit, recordAttempt } from "../security/rate-limit.ts";
import { logSecurityEvent } from "../security/events.ts";
import { issueOtp, verifyOtp } from "./verification.ts";

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function isValidEmail(email: string): boolean {
  return EMAIL_PATTERN.test(email);
}

export type RequestChangeEmailResult =
  | { success: true }
  | { success: false; reason: "invalid_email" | "same_email" | "rate_limited" };

export async function requestChangeEmail(params: {
  userId: string;
  newEmail: string;
}): Promise<RequestChangeEmailResult> {
  if (!isValidEmail(params.newEmail)) {
    return { success: false, reason: "invalid_email" };
  }

  const { allowed } = await checkRateLimit(params.newEmail);
  if (!allowed) {
    return { success: false, reason: "rate_limited" };
  }

  const existing = await findUserByEmail(params.newEmail);

  if (existing && existing.id === params.userId) {
    return { success: false, reason: "same_email" };
  }

  if (existing) {
    // Recorded as a failure deliberately - same rate-limiting rationale as
    // T3.1 requirement 8 (issue #35): repeated targeting of the same email
    // throttles identically whether it belongs to someone else already or
    // becomes theirs from this call.
    await recordAttempt(params.newEmail, false);
    await sendEmail({
      to: params.newEmail,
      subject: "Someone tried to change their email to yours",
      text: "Someone attempted to change their Trackr account email to this address. If this wasn't you, no action is needed.",
    });
    return { success: true };
  }

  await recordAttempt(params.newEmail, true);
  await issueOtp(params.userId, "change_email", params.newEmail, { newEmail: params.newEmail });

  return { success: true };
}

export type ConfirmChangeEmailResult =
  | { success: true }
  | {
      success: false;
      reason: "expired" | "incorrect" | "locked";
      attemptsRemaining?: number;
    };

export async function confirmChangeEmail(
  userId: string,
  code: string,
): Promise<ConfirmChangeEmailResult> {
  const result = await verifyOtp(userId, "change_email", code);
  if (!result.success) {
    return result;
  }

  if (result.newEmail) {
    await updateEmail(userId, result.newEmail);
    await logSecurityEvent("email_changed", { userId, metadata: { newEmail: result.newEmail } });
  }

  return { success: true };
}

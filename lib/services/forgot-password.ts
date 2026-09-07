import { findUserForLogin, updatePasswordHash } from "../repositories/user.ts";
import { hashPassword } from "../security/password.ts";
import { checkRateLimit, recordAttempt } from "../security/rate-limit.ts";
import { issueSession, revokeAllSessions } from "./session.ts";
import { issueOtp, verifyOtp } from "./verification.ts";

const MIN_PASSWORD_LENGTH = 12;

export type RequestPasswordResetResult =
  | { success: true }
  | { success: false; reason: "rate_limited" };

export async function requestPasswordReset(email: string): Promise<RequestPasswordResetResult> {
  // Every request counts toward the limit unconditionally - see issue #45
  // for why this is the opposite mapping from T3.1/T3.6. The abuse case
  // here is repeated targeting of a real registered email (inbox spam),
  // not targeting an available one.
  const { allowed } = await checkRateLimit(email);
  if (!allowed) {
    return { success: false, reason: "rate_limited" };
  }
  await recordAttempt(email, false);

  const user = await findUserForLogin(email);
  if (user) {
    await issueOtp(user.id, "password_reset", email);
  }

  // Never reveal account existence.
  return { success: true };
}

export type ResetPasswordResult =
  | { success: true; rawToken: string; expiresAt: Date }
  | {
      success: false;
      reason: "weak_password" | "expired" | "incorrect" | "locked";
      attemptsRemaining?: number;
    };

export async function resetPassword(params: {
  email: string;
  code: string;
  newPassword: string;
}): Promise<ResetPasswordResult> {
  if (params.newPassword.length < MIN_PASSWORD_LENGTH) {
    return { success: false, reason: "weak_password" };
  }

  const user = await findUserForLogin(params.email);
  if (!user) {
    return { success: false, reason: "incorrect" };
  }

  const result = await verifyOtp(user.id, "password_reset", params.code);
  if (!result.success) {
    return result;
  }

  const passwordHash = await hashPassword(params.newPassword);
  await updatePasswordHash(user.id, passwordHash);

  // A password reset is a credible signal that any existing session
  // shouldn't be trusted going forward - not specified in the docs, added
  // as standard practice (noted on issue #45).
  await revokeAllSessions(user.id);

  const { rawToken, expiresAt } = await issueSession(user.id);

  return { success: true, rawToken, expiresAt };
}

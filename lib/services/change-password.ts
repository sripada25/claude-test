import { findPasswordHashById, updatePasswordHash } from "../repositories/user.ts";
import { hashPassword, verifyPassword } from "../security/password.ts";
import { checkRateLimit, recordAttempt } from "../security/rate-limit.ts";
import { logSecurityEvent } from "../security/events.ts";
import { revokeAllSessions } from "./session.ts";

const MIN_PASSWORD_LENGTH = 12;

const DUMMY_PASSWORD = "dummy-password-for-timing-safety-only";
let dummyHashPromise: Promise<string> | null = null;

function getDummyHash(): Promise<string> {
  if (!dummyHashPromise) {
    dummyHashPromise = hashPassword(DUMMY_PASSWORD);
  }
  return dummyHashPromise;
}

export type ChangePasswordResult =
  | { success: true }
  | { success: false; reason: "weak_password" | "incorrect_current_password" | "rate_limited" };

// M09-4: mirrors forgot-password.ts's resetPassword - same shape (verify
// identity, hash, persist, revoke sessions), different identity proof
// (current password here, an OTP code there). Doubles as "set a password"
// for an OAuth-only account: hasPasswordHash's absence means there's
// nothing to verify, not that verification failed.
export async function changePassword(
  userId: string,
  params: { currentPassword?: string; newPassword: string },
): Promise<ChangePasswordResult> {
  if (params.newPassword.length < MIN_PASSWORD_LENGTH) {
    return { success: false, reason: "weak_password" };
  }

  const identifier = `change_password:${userId}`;
  const { allowed } = await checkRateLimit(identifier);
  if (!allowed) {
    return { success: false, reason: "rate_limited" };
  }

  const currentHash = await findPasswordHashById(userId);
  const hashToCompare = currentHash ?? (await getDummyHash());
  const suppliedPassword = params.currentPassword ?? DUMMY_PASSWORD;
  const passwordMatches = await verifyPassword(hashToCompare, suppliedPassword);

  // No current hash at all means there's nothing to verify - this is
  // setting an initial password (OAuth-only account), not changing one.
  // A real hash requires a real, matching supplied password.
  const identityConfirmed = currentHash === null || (Boolean(params.currentPassword) && passwordMatches);

  if (!identityConfirmed) {
    await recordAttempt(identifier, false);
    await logSecurityEvent("password_change_failed", { userId });
    return { success: false, reason: "incorrect_current_password" };
  }

  await recordAttempt(identifier, true);

  const newHash = await hashPassword(params.newPassword);
  await updatePasswordHash(userId, newHash);
  await logSecurityEvent("password_changed", { userId });

  // Same reasoning as resetPassword: a password change is a credible signal
  // that existing sessions - including this one - shouldn't be trusted
  // going forward. The caller will need to sign back in.
  await revokeAllSessions(userId);

  return { success: true };
}

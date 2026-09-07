import { findUserForLogin } from "../repositories/user.ts";
import { hashPassword, verifyPassword } from "../security/password.ts";
import { checkRateLimit, recordAttempt } from "../security/rate-limit.ts";
import { logSecurityEvent } from "../security/events.ts";
import { issueSession } from "./session.ts";

const DUMMY_PASSWORD = "dummy-password-for-timing-safety-only";
let dummyHashPromise: Promise<string> | null = null;

function getDummyHash(): Promise<string> {
  if (!dummyHashPromise) {
    dummyHashPromise = hashPassword(DUMMY_PASSWORD);
  }
  return dummyHashPromise;
}

export type LoginResult =
  | { success: true; rawToken: string; expiresAt: Date }
  | { success: false; reason: "invalid_credentials" | "rate_limited" };

export async function login(params: { email: string; password: string }): Promise<LoginResult> {
  const { allowed } = await checkRateLimit(params.email);
  if (!allowed) {
    return { success: false, reason: "rate_limited" };
  }

  const user = await findUserForLogin(params.email);
  const hashToCompare = user?.passwordHash ?? (await getDummyHash());
  const passwordMatches = await verifyPassword(hashToCompare, params.password);

  const succeeded = Boolean(user && user.passwordHash && passwordMatches);

  if (!succeeded) {
    await recordAttempt(params.email, false);
    await logSecurityEvent("login_failed", { metadata: { email: params.email } });
    return { success: false, reason: "invalid_credentials" };
  }

  await recordAttempt(params.email, true);
  await logSecurityEvent("login_success", { userId: user!.id });

  const { rawToken, expiresAt } = await issueSession(user!.id);
  return { success: true, rawToken, expiresAt };
}

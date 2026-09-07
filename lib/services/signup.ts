import { createAccount } from "../repositories/signup.ts";
import { findUserByEmail } from "../repositories/user.ts";
import { sendEmail } from "../email/transport.ts";
import { hashPassword } from "../security/password.ts";
import { checkRateLimit, recordAttempt } from "../security/rate-limit.ts";
import { issueOtp } from "./verification.ts";

const MIN_PASSWORD_LENGTH = 12;
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export type SignupResult =
  | { success: true }
  | {
      success: false;
      reason: "invalid_email" | "weak_password" | "invalid_timezone" | "rate_limited";
    };

function isValidEmail(email: string): boolean {
  return EMAIL_PATTERN.test(email);
}

function isValidTimezone(timezone: string): boolean {
  try {
    new Intl.DateTimeFormat(undefined, { timeZone: timezone });
    return true;
  } catch {
    return false;
  }
}

function currentMonthStart(): string {
  const now = new Date();
  const year = now.getUTCFullYear();
  const month = String(now.getUTCMonth() + 1).padStart(2, "0");
  return `${year}-${month}-01`;
}

export async function signup(params: {
  email: string;
  password: string;
  timezone: string;
}): Promise<SignupResult> {
  if (!isValidEmail(params.email)) {
    return { success: false, reason: "invalid_email" };
  }
  if (params.password.length < MIN_PASSWORD_LENGTH) {
    return { success: false, reason: "weak_password" };
  }
  if (!isValidTimezone(params.timezone)) {
    return { success: false, reason: "invalid_timezone" };
  }

  const { allowed } = await checkRateLimit(params.email);
  if (!allowed) {
    return { success: false, reason: "rate_limited" };
  }

  const existing = await findUserByEmail(params.email);
  if (existing) {
    // Recorded as a "failure" deliberately - repeated targeting of the same
    // email (whether pre-existing or just created a moment ago) throttles
    // identically either way. See issue #35 requirement 8.
    await recordAttempt(params.email, false);
    await sendEmail({
      to: params.email,
      subject: "Someone tried to sign up with your email",
      text: "Someone attempted to create a Trackr account using your email address. If this wasn't you, no action is needed - your existing account is safe. If this was you, sign in instead.",
    });
    return { success: true };
  }

  const passwordHash = await hashPassword(params.password);
  const { userId } = await createAccount({
    email: params.email,
    passwordHash,
    timezone: params.timezone,
    periodStart: currentMonthStart(),
  });
  await recordAttempt(params.email, true);

  await issueOtp(userId, "verify_email", params.email);

  return { success: true };
}

import { createHash, randomInt } from "node:crypto";
import { sendEmail } from "../email/transport.ts";
import { countRecentSends, insertEmailLog } from "../repositories/email-log.ts";
import {
  findActiveToken,
  incrementAttempts,
  insertToken,
  invalidateActiveTokens,
  markUsed,
} from "../repositories/verification-token.ts";

const OTP_EXPIRY_MS = 10 * 60 * 1000;
const MAX_ATTEMPTS = 5;
const RESEND_MAX_PER_HOUR = 3;
const RESEND_WINDOW_MINUTES = 60;

function hashCode(code: string): string {
  return createHash("sha256").update(code).digest("hex");
}

function generateCode(): string {
  return randomInt(100000, 1000000).toString();
}

export async function issueOtp(
  userId: string,
  purpose: string,
  email: string,
  options: { newEmail?: string } = {},
): Promise<void> {
  const code = generateCode();
  const tokenHash = hashCode(code);
  const expiresAt = new Date(Date.now() + OTP_EXPIRY_MS);

  await invalidateActiveTokens(userId, purpose);
  await insertToken({ userId, tokenHash, purpose, expiresAt, newEmail: options.newEmail });

  await sendEmail({
    to: email,
    subject: "Your Trackr verification code",
    text: `Your verification code is ${code}. It expires in 10 minutes.`,
  });

  await insertEmailLog({
    userId,
    recipient: email,
    purpose,
    sentAt: new Date(),
    failedAt: null,
    error: null,
  });
}

export type VerifyOtpResult =
  | { success: true; newEmail: string | null }
  | { success: false; reason: "expired" | "incorrect" | "locked"; attemptsRemaining?: number };

export async function verifyOtp(
  userId: string,
  purpose: string,
  code: string,
): Promise<VerifyOtpResult> {
  const token = await findActiveToken(userId, purpose);

  // No active token at all reads the same as "locked" to the caller - either
  // way, the only path forward is requesting a new code.
  if (!token) {
    return { success: false, reason: "locked" };
  }

  if (token.expiresAt.getTime() <= Date.now()) {
    return { success: false, reason: "expired" };
  }

  if (hashCode(code) === token.tokenHash) {
    await markUsed(token.id);
    return { success: true, newEmail: token.newEmail };
  }

  const attempts = await incrementAttempts(token.id);
  if (attempts >= MAX_ATTEMPTS) {
    await markUsed(token.id);
    return { success: false, reason: "locked" };
  }

  return { success: false, reason: "incorrect", attemptsRemaining: MAX_ATTEMPTS - attempts };
}

export async function canResend(userId: string, purpose: string): Promise<boolean> {
  const recentSends = await countRecentSends(userId, purpose, RESEND_WINDOW_MINUTES);
  return recentSends < RESEND_MAX_PER_HOUR;
}

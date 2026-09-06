import { NextResponse } from "next/server";
import { findUserByEmail, markEmailVerified } from "@/lib/repositories/user";
import { SESSION_COOKIE_NAME, sessionCookieOptions } from "@/lib/security/session-cookie";
import { issueSession } from "@/lib/services/session";
import { verifyOtp } from "@/lib/services/verification";

export async function POST(request: Request): Promise<NextResponse> {
  const body = await request.json().catch(() => null);
  const email = typeof body?.email === "string" ? body.email : null;
  const code = typeof body?.code === "string" ? body.code : null;

  if (!email || !code) {
    return NextResponse.json({ success: false, reason: "invalid" }, { status: 400 });
  }

  const user = await findUserByEmail(email);
  if (!user) {
    // Never reveal account existence - same shape as a real "incorrect" result.
    return NextResponse.json({ success: false, reason: "incorrect" }, { status: 400 });
  }

  const result = await verifyOtp(user.id, "verify_email", code);
  if (!result.success) {
    return NextResponse.json(result, { status: 400 });
  }

  await markEmailVerified(user.id);
  const { rawToken } = await issueSession(user.id);

  const response = NextResponse.json({ success: true });
  response.cookies.set(SESSION_COOKIE_NAME, rawToken, sessionCookieOptions());
  return response;
}

import { NextResponse } from "next/server";
import { SESSION_COOKIE_NAME, sessionCookieOptions } from "@/lib/security/session-cookie";
import { resetPassword } from "@/lib/services/forgot-password";

export async function POST(request: Request): Promise<NextResponse> {
  const body = await request.json().catch(() => null);
  const email = typeof body?.email === "string" ? body.email : null;
  const code = typeof body?.code === "string" ? body.code : null;
  const newPassword = typeof body?.newPassword === "string" ? body.newPassword : null;

  if (!email || !code || !newPassword) {
    return NextResponse.json({ success: false, reason: "invalid" }, { status: 400 });
  }

  const result = await resetPassword({ email, code, newPassword });

  if (!result.success) {
    return NextResponse.json(result, { status: 400 });
  }

  const response = NextResponse.json({ success: true });
  response.cookies.set(SESSION_COOKIE_NAME, result.rawToken, sessionCookieOptions());
  return response;
}

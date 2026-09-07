import { NextResponse } from "next/server";
import { SESSION_COOKIE_NAME, sessionCookieOptions } from "@/lib/security/session-cookie";
import { login } from "@/lib/services/login";

export async function POST(request: Request): Promise<NextResponse> {
  const body = await request.json().catch(() => null);
  const email = typeof body?.email === "string" ? body.email : null;
  const password = typeof body?.password === "string" ? body.password : null;

  if (!email || !password) {
    return NextResponse.json({ success: false, reason: "invalid" }, { status: 400 });
  }

  const result = await login({ email, password });

  if (!result.success) {
    const status = result.reason === "rate_limited" ? 429 : 401;
    return NextResponse.json({ success: false, reason: result.reason }, { status });
  }

  const response = NextResponse.json({ success: true });
  response.cookies.set(SESSION_COOKIE_NAME, result.rawToken, sessionCookieOptions());
  return response;
}

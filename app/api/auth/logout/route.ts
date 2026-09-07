import { NextResponse } from "next/server";
import { SESSION_COOKIE_NAME, clearedSessionCookieOptions } from "@/lib/security/session-cookie";
import { revokeSession } from "@/lib/services/session";

export async function POST(request: Request): Promise<NextResponse> {
  const cookieHeader = request.headers.get("cookie") ?? "";
  const match = cookieHeader.match(new RegExp(`(?:^|; )${SESSION_COOKIE_NAME}=([^;]+)`));
  const rawToken = match ? decodeURIComponent(match[1]) : null;

  if (rawToken) {
    await revokeSession(rawToken);
  }

  const response = NextResponse.json({ success: true });
  response.cookies.set(SESSION_COOKIE_NAME, "", clearedSessionCookieOptions());
  return response;
}

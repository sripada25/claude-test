import { NextResponse } from "next/server";
import {
  SESSION_COOKIE_NAME,
  clearedSessionCookieOptions,
  getSessionTokenFromRequest,
} from "@/lib/security/session-cookie";
import { resolveSession, revokeAllSessions } from "@/lib/services/session";

export async function POST(request: Request): Promise<NextResponse> {
  const rawToken = getSessionTokenFromRequest(request);
  const resolved = rawToken ? await resolveSession(rawToken) : null;

  if (!resolved) {
    return NextResponse.json({ success: false, reason: "unauthorized" }, { status: 401 });
  }

  await revokeAllSessions(resolved.userId);

  const response = NextResponse.json({ success: true });
  response.cookies.set(SESSION_COOKIE_NAME, "", clearedSessionCookieOptions());
  return response;
}

import { NextResponse } from "next/server";
import { SESSION_COOKIE_NAME } from "@/lib/security/session-cookie";
import { logSecurityEvent } from "@/lib/security/events";
import { resolveSession } from "@/lib/services/session";

export async function GET(request: Request): Promise<NextResponse> {
  const cookieHeader = request.headers.get("cookie") ?? "";
  const match = cookieHeader.match(new RegExp(`(?:^|; )${SESSION_COOKIE_NAME}=([^;]+)`));
  const rawToken = match ? decodeURIComponent(match[1]) : null;

  if (!rawToken) {
    return NextResponse.json({ authenticated: false });
  }

  try {
    const resolved = await resolveSession(rawToken);
    if (!resolved) {
      return NextResponse.json({ authenticated: false });
    }
    return NextResponse.json({ authenticated: true, userId: resolved.userId });
  } catch {
    await logSecurityEvent("session_resolution_failed", {
      userAgent: request.headers.get("user-agent") ?? undefined,
    });
    return NextResponse.json({ authenticated: false });
  }
}

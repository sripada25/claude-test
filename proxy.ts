import { NextResponse, type NextRequest } from "next/server";
import { getOrSetCsrfCookie, validateCsrf } from "@/lib/security/csrf";
import { logSecurityEvent } from "@/lib/security/events";
import { resolveSession } from "@/lib/services/session";

// No name is pinned in the docs beyond the __Host- prefix requirement
// (SECURITY_quarterfinal.md §15) - "session" is this task's choice.
const SESSION_COOKIE_NAME =
  process.env.NODE_ENV === "production" ? "__Host-session" : "session";

const PUBLIC_PATHS = new Set(["/", "/signin", "/privacy", "/terms"]);
const PUBLIC_PREFIXES = ["/api/auth/", "/api/oauth/"];

function isPublicPath(pathname: string): boolean {
  if (PUBLIC_PATHS.has(pathname)) {
    return true;
  }
  return PUBLIC_PREFIXES.some((prefix) => pathname.startsWith(prefix));
}

function deny(request: NextRequest): NextResponse {
  if (request.nextUrl.pathname.startsWith("/api/")) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  return NextResponse.redirect(new URL("/signin", request.url));
}

function finalize(request: NextRequest, response: NextResponse): NextResponse {
  getOrSetCsrfCookie(request, response);
  return response;
}

export default async function proxy(request: NextRequest): Promise<NextResponse> {
  if (!validateCsrf(request)) {
    return finalize(request, NextResponse.json({ error: "Forbidden" }, { status: 403 }));
  }

  const { pathname } = request.nextUrl;

  if (isPublicPath(pathname)) {
    return finalize(request, NextResponse.next());
  }

  const rawToken = request.cookies.get(SESSION_COOKIE_NAME)?.value;

  if (!rawToken) {
    return finalize(request, deny(request));
  }

  try {
    const resolved = await resolveSession(rawToken);

    if (!resolved) {
      return finalize(request, deny(request));
    }

    const headers = new Headers(request.headers);
    headers.set("x-user-id", resolved.userId);
    return finalize(request, NextResponse.next({ request: { headers } }));
  } catch {
    // ip omitted deliberately - see issue #25. Trust-proxy IP resolution
    // (T7.5) is deploy-only and doesn't exist yet; logging a naive,
    // spoofable IP here would be worse than logging none.
    await logSecurityEvent("session_resolution_failed", {
      userAgent: request.headers.get("user-agent") ?? undefined,
    });
    return finalize(request, deny(request));
  }
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)"],
};

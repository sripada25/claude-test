import { NextResponse, type NextRequest } from "next/server";
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

export default async function proxy(request: NextRequest): Promise<NextResponse> {
  const { pathname } = request.nextUrl;

  if (isPublicPath(pathname)) {
    return NextResponse.next();
  }

  const rawToken = request.cookies.get(SESSION_COOKIE_NAME)?.value;

  if (!rawToken) {
    return deny(request);
  }

  try {
    const resolved = await resolveSession(rawToken);

    if (!resolved) {
      return deny(request);
    }

    const headers = new Headers(request.headers);
    headers.set("x-user-id", resolved.userId);
    return NextResponse.next({ request: { headers } });
  } catch {
    // ip omitted deliberately - see issue #25. Trust-proxy IP resolution
    // (T7.5) is deploy-only and doesn't exist yet; logging a naive,
    // spoofable IP here would be worse than logging none.
    await logSecurityEvent("session_resolution_failed", {
      userAgent: request.headers.get("user-agent") ?? undefined,
    });
    return deny(request);
  }
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)"],
};

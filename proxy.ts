import { NextResponse, type NextRequest } from "next/server";
import { getOrSetCsrfCookie, validateCsrf } from "@/lib/security/csrf";
import { logSecurityEvent } from "@/lib/security/events";
import { buildSecurityHeaders, generateNonce } from "@/lib/security/headers";
import { SESSION_COOKIE_NAME } from "@/lib/security/session-cookie";
import { resolveSession } from "@/lib/services/session";

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

function finalize(
  response: NextResponse,
  securityHeaders: Record<string, string>,
  request: NextRequest,
): NextResponse {
  getOrSetCsrfCookie(request, response);
  for (const [name, value] of Object.entries(securityHeaders)) {
    response.headers.set(name, value);
  }
  return response;
}

export default async function proxy(request: NextRequest): Promise<NextResponse> {
  // Generated once per request. Next.js extracts the nonce for its own
  // inline scripts by parsing the CSP value off the incoming REQUEST
  // header during rendering - the response header alone isn't enough, and
  // this only works because every page is forced dynamic (see the page
  // files' `connection()` calls) since a statically-generated page has no
  // per-request nonce to inject.
  const nonce = generateNonce();
  const securityHeaders = buildSecurityHeaders(nonce);
  const forwardedHeaders = new Headers(request.headers);
  forwardedHeaders.set("x-nonce", nonce);
  forwardedHeaders.set("Content-Security-Policy", securityHeaders["Content-Security-Policy"]);

  if (!validateCsrf(request)) {
    return finalize(
      NextResponse.json({ error: "Forbidden" }, { status: 403 }),
      securityHeaders,
      request,
    );
  }

  const { pathname } = request.nextUrl;

  if (isPublicPath(pathname)) {
    return finalize(
      NextResponse.next({ request: { headers: forwardedHeaders } }),
      securityHeaders,
      request,
    );
  }

  const rawToken = request.cookies.get(SESSION_COOKIE_NAME)?.value;

  if (!rawToken) {
    return finalize(deny(request), securityHeaders, request);
  }

  try {
    const resolved = await resolveSession(rawToken);

    if (!resolved) {
      return finalize(deny(request), securityHeaders, request);
    }

    forwardedHeaders.set("x-user-id", resolved.userId);
    return finalize(
      NextResponse.next({ request: { headers: forwardedHeaders } }),
      securityHeaders,
      request,
    );
  } catch {
    // ip omitted deliberately - see issue #25. Trust-proxy IP resolution
    // (T7.5) is deploy-only and doesn't exist yet; logging a naive,
    // spoofable IP here would be worse than logging none.
    await logSecurityEvent("session_resolution_failed", {
      userAgent: request.headers.get("user-agent") ?? undefined,
    });
    return finalize(deny(request), securityHeaders, request);
  }
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)"],
};

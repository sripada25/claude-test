import { NextResponse } from "next/server";
import { completeGoogleSignIn } from "@/lib/services/oauth-google-signin";
import { SESSION_COOKIE_NAME, sessionCookieOptions } from "@/lib/security/session-cookie";
import {
  OAUTH_STATE_COOKIE_NAME,
  OAUTH_TZ_COOKIE_NAME,
  clearedOauthCookieOptions,
  getOauthStateFromRequest,
  getOauthTzFromRequest,
} from "@/lib/security/oauth-cookie";

function errorRedirect(request: Request, reason: string): NextResponse {
  const url = new URL("/signin", request.url);
  url.searchParams.set("oauth_error", reason);
  const response = NextResponse.redirect(url);
  response.cookies.set(OAUTH_STATE_COOKIE_NAME, "", clearedOauthCookieOptions());
  response.cookies.set(OAUTH_TZ_COOKIE_NAME, "", clearedOauthCookieOptions());
  return response;
}

export async function GET(request: Request): Promise<NextResponse> {
  const url = new URL(request.url);
  const googleError = url.searchParams.get("error");
  if (googleError) {
    return errorRedirect(request, "denied");
  }

  const redirectUri = `${process.env.NEXT_PUBLIC_APP_URL}/api/oauth/google/callback`;

  const result = await completeGoogleSignIn({
    queryState: url.searchParams.get("state"),
    cookieState: getOauthStateFromRequest(request),
    code: url.searchParams.get("code"),
    timezone: getOauthTzFromRequest(request),
    redirectUri,
  });

  if (!result.success) {
    return errorRedirect(request, result.reason);
  }

  const response = NextResponse.redirect(new URL("/", request.url));
  response.cookies.set(SESSION_COOKIE_NAME, result.rawToken, sessionCookieOptions());
  response.cookies.set(OAUTH_STATE_COOKIE_NAME, "", clearedOauthCookieOptions());
  response.cookies.set(OAUTH_TZ_COOKIE_NAME, "", clearedOauthCookieOptions());
  return response;
}

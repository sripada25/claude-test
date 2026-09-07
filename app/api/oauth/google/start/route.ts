import { NextResponse } from "next/server";
import { buildGoogleAuthorizationUrl } from "@/lib/oauth/google";
import { createOauthState } from "@/lib/services/oauth-state";
import {
  OAUTH_STATE_COOKIE_NAME,
  OAUTH_TZ_COOKIE_NAME,
  oauthCookieOptions,
} from "@/lib/security/oauth-cookie";

function isValidTimezone(timezone: string): boolean {
  try {
    new Intl.DateTimeFormat(undefined, { timeZone: timezone });
    return true;
  } catch {
    return false;
  }
}

export async function GET(request: Request): Promise<NextResponse> {
  const requestedTimezone = new URL(request.url).searchParams.get("timezone");
  const timezone =
    requestedTimezone && isValidTimezone(requestedTimezone) ? requestedTimezone : "UTC";

  const redirectUri = `${process.env.NEXT_PUBLIC_APP_URL}/api/oauth/google/callback`;

  const { state, codeChallenge } = await createOauthState({ provider: "google" });

  const authorizationUrl = buildGoogleAuthorizationUrl({ state, codeChallenge, redirectUri });

  const response = NextResponse.redirect(authorizationUrl);
  response.cookies.set(OAUTH_STATE_COOKIE_NAME, state, oauthCookieOptions());
  response.cookies.set(OAUTH_TZ_COOKIE_NAME, timezone, oauthCookieOptions());
  return response;
}

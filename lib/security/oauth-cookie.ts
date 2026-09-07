export const OAUTH_STATE_COOKIE_NAME = "oauth_state";
export const OAUTH_TZ_COOKIE_NAME = "oauth_tz";

const OAUTH_COOKIE_MAX_AGE_SECONDS = 10 * 60; // matches oauth_states' 10-minute expiry

export function oauthCookieOptions(): {
  httpOnly: true;
  secure: boolean;
  sameSite: "lax";
  path: "/";
  maxAge: number;
} {
  return {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: OAUTH_COOKIE_MAX_AGE_SECONDS,
  };
}

export function clearedOauthCookieOptions(): {
  httpOnly: true;
  secure: boolean;
  sameSite: "lax";
  path: "/";
  maxAge: 0;
} {
  return {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 0,
  };
}

function readCookie(request: Request, name: string): string | null {
  const cookieHeader = request.headers.get("cookie") ?? "";
  const match = cookieHeader.match(new RegExp(`(?:^|; )${name}=([^;]+)`));
  return match ? decodeURIComponent(match[1]) : null;
}

export function getOauthStateFromRequest(request: Request): string | null {
  return readCookie(request, OAUTH_STATE_COOKIE_NAME);
}

export function getOauthTzFromRequest(request: Request): string | null {
  return readCookie(request, OAUTH_TZ_COOKIE_NAME);
}

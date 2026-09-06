import { randomBytes } from "node:crypto";
import type { NextRequest, NextResponse } from "next/server";

const CSRF_COOKIE_NAME = process.env.NODE_ENV === "production" ? "__Host-csrf" : "csrf";
const CSRF_HEADER_NAME = "x-csrf-token";
const STATE_CHANGING_METHODS = new Set(["POST", "PUT", "PATCH", "DELETE"]);

function isStateChangingMethod(method: string): boolean {
  return STATE_CHANGING_METHODS.has(method.toUpperCase());
}

export function getOrSetCsrfCookie(request: NextRequest, response: NextResponse): string {
  const existing = request.cookies.get(CSRF_COOKIE_NAME)?.value;
  if (existing) {
    return existing;
  }

  const token = randomBytes(32).toString("base64url");
  response.cookies.set(CSRF_COOKIE_NAME, token, {
    httpOnly: false,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
  });
  return token;
}

function resolveRequestOrigin(request: NextRequest): string | null {
  const origin = request.headers.get("origin");
  if (origin) {
    return origin;
  }

  const referer = request.headers.get("referer");
  if (!referer) {
    return null;
  }

  try {
    return new URL(referer).origin;
  } catch {
    return null;
  }
}

export function validateCsrf(request: NextRequest): boolean {
  if (!isStateChangingMethod(request.method)) {
    return true;
  }

  const cookieToken = request.cookies.get(CSRF_COOKIE_NAME)?.value;
  const headerToken = request.headers.get(CSRF_HEADER_NAME);

  if (!cookieToken || !headerToken || cookieToken !== headerToken) {
    return false;
  }

  const appUrl = process.env.NEXT_PUBLIC_APP_URL;
  if (!appUrl) {
    return false;
  }

  const requestOrigin = resolveRequestOrigin(request);
  if (!requestOrigin) {
    return false;
  }

  return requestOrigin === new URL(appUrl).origin;
}

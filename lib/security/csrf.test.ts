import { NextRequest, NextResponse } from "next/server";
import { beforeAll, describe, expect, it } from "vitest";
import { getOrSetCsrfCookie, validateCsrf } from "./csrf.ts";

beforeAll(() => {
  process.env.NEXT_PUBLIC_APP_URL = "http://localhost:3000";
});

function requestWith(options: {
  method?: string;
  cookie?: string;
  csrfHeader?: string;
  origin?: string;
  referer?: string;
}): NextRequest {
  const headers: Record<string, string> = {};
  if (options.cookie) headers.cookie = options.cookie;
  if (options.csrfHeader) headers["x-csrf-token"] = options.csrfHeader;
  if (options.origin) headers.origin = options.origin;
  if (options.referer) headers.referer = options.referer;

  return new NextRequest("http://localhost:3000/api/auth/login", {
    method: options.method ?? "POST",
    headers,
  });
}

describe("validateCsrf", () => {
  it("is always valid for GET/HEAD - no token required", () => {
    expect(validateCsrf(requestWith({ method: "GET" }))).toBe(true);
    expect(validateCsrf(requestWith({ method: "HEAD" }))).toBe(true);
  });

  it("is valid when the header matches the cookie and Origin matches the app URL", () => {
    const request = requestWith({
      cookie: "csrf=matching-token",
      csrfHeader: "matching-token",
      origin: "http://localhost:3000",
    });
    expect(validateCsrf(request)).toBe(true);
  });

  it("is invalid when the header token doesn't match the cookie", () => {
    const request = requestWith({
      cookie: "csrf=cookie-token",
      csrfHeader: "different-token",
      origin: "http://localhost:3000",
    });
    expect(validateCsrf(request)).toBe(false);
  });

  it("is invalid when the header is missing entirely", () => {
    const request = requestWith({
      cookie: "csrf=cookie-token",
      origin: "http://localhost:3000",
    });
    expect(validateCsrf(request)).toBe(false);
  });

  it("is invalid when Origin doesn't match the app URL", () => {
    const request = requestWith({
      cookie: "csrf=matching-token",
      csrfHeader: "matching-token",
      origin: "http://evil.example.com",
    });
    expect(validateCsrf(request)).toBe(false);
  });

  it("falls back to Referer when Origin is absent", () => {
    const request = requestWith({
      cookie: "csrf=matching-token",
      csrfHeader: "matching-token",
      referer: "http://localhost:3000/signin",
    });
    expect(validateCsrf(request)).toBe(true);
  });

  it("is invalid when neither Origin nor Referer is present", () => {
    const request = requestWith({
      cookie: "csrf=matching-token",
      csrfHeader: "matching-token",
    });
    expect(validateCsrf(request)).toBe(false);
  });
});

describe("getOrSetCsrfCookie", () => {
  it("returns the existing cookie value without setting a new one", () => {
    const request = requestWith({ method: "GET", cookie: "csrf=already-set" });
    const response = NextResponse.next();

    const token = getOrSetCsrfCookie(request, response);

    expect(token).toBe("already-set");
    expect(response.cookies.get("csrf")).toBeUndefined();
  });

  it("generates and sets a new token when none exists", () => {
    const request = requestWith({ method: "GET" });
    const response = NextResponse.next();

    const token = getOrSetCsrfCookie(request, response);

    expect(token.length).toBeGreaterThan(20);
    expect(response.cookies.get("csrf")?.value).toBe(token);
  });
});

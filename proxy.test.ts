import { NextRequest } from "next/server";
import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/services/session", () => ({
  resolveSession: vi.fn(),
}));
vi.mock("@/lib/security/events", () => ({
  logSecurityEvent: vi.fn(),
}));

import { logSecurityEvent } from "@/lib/security/events";
import { resolveSession } from "@/lib/services/session";
import proxy from "./proxy";

const resolveSessionMock = vi.mocked(resolveSession);
const logSecurityEventMock = vi.mocked(logSecurityEvent);

function requestTo(path: string, cookie?: string): NextRequest {
  return new NextRequest(`http://localhost:3000${path}`, {
    headers: cookie ? { cookie } : undefined,
  });
}

function postRequestTo(
  path: string,
  options: { sessionCookie?: string; csrfToken?: string; origin?: string } = {},
): NextRequest {
  const cookies = [
    options.sessionCookie ? `session=${options.sessionCookie}` : null,
    options.csrfToken ? `csrf=${options.csrfToken}` : null,
  ]
    .filter(Boolean)
    .join("; ");

  const headers: Record<string, string> = {};
  if (cookies) headers.cookie = cookies;
  if (options.csrfToken) headers["x-csrf-token"] = options.csrfToken;
  if (options.origin) headers.origin = options.origin;

  return new NextRequest(`http://localhost:3000${path}`, { method: "POST", headers });
}

describe("proxy", () => {
  beforeAll(() => {
    process.env.NEXT_PUBLIC_APP_URL = "http://localhost:3000";
  });

  beforeEach(() => {
    resolveSessionMock.mockReset();
    logSecurityEventMock.mockReset();
  });

  it("passes public paths through without calling resolveSession", async () => {
    for (const path of ["/", "/signin", "/privacy", "/terms", "/api/auth/login"]) {
      const response = await proxy(requestTo(path));
      expect(response.status).not.toBe(401);
      expect(resolveSessionMock).not.toHaveBeenCalled();
    }
  });

  it("denies a protected path with no session cookie at all", async () => {
    const response = await proxy(requestTo("/app/board"));

    expect(response.status).toBe(307); // redirect
    expect(resolveSessionMock).not.toHaveBeenCalled();
  });

  it("denies when resolveSession returns null (covers expired, revoked, and not-found alike - the service already treats these identically)", async () => {
    resolveSessionMock.mockResolvedValue(null);

    const response = await proxy(requestTo("/app/board", "session=some-raw-token"));

    expect(response.status).toBe(307);
  });

  it("denies an API path with 401 JSON instead of a redirect", async () => {
    resolveSessionMock.mockResolvedValue(null);

    const response = await proxy(requestTo("/api/profile", "session=some-raw-token"));

    expect(response.status).toBe(401);
    const body = await response.json();
    expect(body).toEqual({ error: "Unauthorized" });
  });

  it("attaches x-user-id for a valid session and lets the request through", async () => {
    resolveSessionMock.mockResolvedValue({ userId: "user-123", sessionId: "session-456" });

    const response = await proxy(requestTo("/app/board", "session=valid-raw-token"));

    expect(response.status).not.toBe(401);
    expect(response.status).not.toBe(307);
    expect(response.headers.get("x-middleware-request-x-user-id")).toBe("user-123");
  });

  it("denies and logs session_resolution_failed when resolveSession throws", async () => {
    resolveSessionMock.mockRejectedValue(new Error("connection refused"));

    const response = await proxy(requestTo("/app/board", "session=some-raw-token"));

    expect(response.status).toBe(307);
    expect(logSecurityEventMock).toHaveBeenCalledWith(
      "session_resolution_failed",
      expect.objectContaining({}),
    );
  });

  it("never leaks the raw cookie value into a logged security event's arguments", async () => {
    resolveSessionMock.mockRejectedValue(new Error("boom"));

    await proxy(requestTo("/app/board", "session=super-secret-raw-token"));

    const loggedArgs = logSecurityEventMock.mock.calls[0];
    expect(JSON.stringify(loggedArgs)).not.toContain("super-secret-raw-token");
  });

  it("never CSRF-checks a GET request, even to a protected path with no session", async () => {
    const response = await proxy(requestTo("/app/board"));
    expect(response.status).not.toBe(403);
  });

  it("denies a POST to a public path with no CSRF token at all - 403, not passed through", async () => {
    const response = await proxy(postRequestTo("/api/auth/login"));

    expect(response.status).toBe(403);
    expect(resolveSessionMock).not.toHaveBeenCalled();
  });

  it("denies a POST with a mismatched CSRF token", async () => {
    const request = new NextRequest("http://localhost:3000/api/auth/login", {
      method: "POST",
      headers: {
        cookie: "csrf=cookie-value",
        "x-csrf-token": "different-value",
        origin: "http://localhost:3000",
      },
    });

    expect((await proxy(request)).status).toBe(403);
  });

  it("proceeds past CSRF to the existing session logic when the token and Origin are valid", async () => {
    resolveSessionMock.mockResolvedValue({ userId: "user-123", sessionId: "session-456" });

    const response = await proxy(
      postRequestTo("/app/board", {
        sessionCookie: "valid-raw-token",
        csrfToken: "matching-token",
        origin: "http://localhost:3000",
      }),
    );

    expect(response.status).not.toBe(403);
    expect(response.headers.get("x-middleware-request-x-user-id")).toBe("user-123");
  });
});

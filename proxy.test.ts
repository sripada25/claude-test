import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

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

describe("proxy", () => {
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
});

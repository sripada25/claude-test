import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/services/session", () => ({
  resolveSession: vi.fn(),
}));
vi.mock("@/lib/security/events", () => ({
  logSecurityEvent: vi.fn(),
}));

import { logSecurityEvent } from "@/lib/security/events";
import { resolveSession } from "@/lib/services/session";
import { GET } from "./route";

const resolveSessionMock = vi.mocked(resolveSession);
const logSecurityEventMock = vi.mocked(logSecurityEvent);

function requestWithCookie(rawToken: string | null): Request {
  return new Request("http://localhost:3000/api/auth/session", {
    headers: rawToken ? { cookie: `session=${rawToken}` } : {},
  });
}

describe("GET /api/auth/session", () => {
  beforeEach(() => {
    resolveSessionMock.mockReset();
    logSecurityEventMock.mockReset();
  });

  it("returns unauthenticated when there is no cookie", async () => {
    const response = await GET(requestWithCookie(null));

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ authenticated: false });
    expect(resolveSessionMock).not.toHaveBeenCalled();
  });

  it("returns authenticated with the userId for a valid session", async () => {
    resolveSessionMock.mockResolvedValue({ userId: "user-123", sessionId: "session-456" });

    const response = await GET(requestWithCookie("valid-token"));

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ authenticated: true, userId: "user-123" });
  });

  it("returns unauthenticated when resolveSession returns null", async () => {
    resolveSessionMock.mockResolvedValue(null);

    const response = await GET(requestWithCookie("stale-token"));

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ authenticated: false });
  });

  it("returns unauthenticated and logs session_resolution_failed when resolveSession throws", async () => {
    resolveSessionMock.mockRejectedValue(new Error("connection refused"));

    const response = await GET(requestWithCookie("any-token"));

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ authenticated: false });
    expect(logSecurityEventMock).toHaveBeenCalledWith(
      "session_resolution_failed",
      expect.objectContaining({}),
    );
  });
});

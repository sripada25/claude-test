import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/services/session", () => ({
  resolveSession: vi.fn(),
}));
vi.mock("@/lib/services/change-email", () => ({
  requestChangeEmail: vi.fn(),
}));

import { requestChangeEmail } from "@/lib/services/change-email";
import { resolveSession } from "@/lib/services/session";
import { POST } from "./route";

const resolveSessionMock = vi.mocked(resolveSession);
const requestChangeEmailMock = vi.mocked(requestChangeEmail);

function requestWith(cookie: string | null, body: unknown): Request {
  return new Request("http://localhost:3000/api/auth/change-email", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      ...(cookie ? { cookie } : {}),
    },
    body: JSON.stringify(body),
  });
}

describe("POST /api/auth/change-email", () => {
  beforeEach(() => {
    resolveSessionMock.mockReset();
    requestChangeEmailMock.mockReset();
  });

  it("returns 401 with no session cookie", async () => {
    const response = await POST(requestWith(null, { newEmail: "a@example.com" }));
    expect(response.status).toBe(401);
    expect(requestChangeEmailMock).not.toHaveBeenCalled();
  });

  it("returns 401 when the session doesn't resolve", async () => {
    resolveSessionMock.mockResolvedValue(null);

    const response = await POST(requestWith("session=bad", { newEmail: "a@example.com" }));
    expect(response.status).toBe(401);
  });

  it("returns 400 invalid when newEmail is missing", async () => {
    resolveSessionMock.mockResolvedValue({ userId: "user-1", sessionId: "s1" });

    const response = await POST(requestWith("session=good", {}));
    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({ success: false, reason: "invalid" });
  });

  it("returns 200 on success", async () => {
    resolveSessionMock.mockResolvedValue({ userId: "user-1", sessionId: "s1" });
    requestChangeEmailMock.mockResolvedValue({ success: true });

    const response = await POST(requestWith("session=good", { newEmail: "new@example.com" }));

    expect(response.status).toBe(200);
    expect(requestChangeEmailMock).toHaveBeenCalledWith({
      userId: "user-1",
      newEmail: "new@example.com",
    });
  });

  it("returns 429 for rate_limited", async () => {
    resolveSessionMock.mockResolvedValue({ userId: "user-1", sessionId: "s1" });
    requestChangeEmailMock.mockResolvedValue({ success: false, reason: "rate_limited" });

    const response = await POST(requestWith("session=good", { newEmail: "new@example.com" }));

    expect(response.status).toBe(429);
  });

  it("returns 400 for a validation failure reason", async () => {
    resolveSessionMock.mockResolvedValue({ userId: "user-1", sessionId: "s1" });
    requestChangeEmailMock.mockResolvedValue({ success: false, reason: "same_email" });

    const response = await POST(requestWith("session=good", { newEmail: "new@example.com" }));

    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({ success: false, reason: "same_email" });
  });
});

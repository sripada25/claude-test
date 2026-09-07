import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/services/session", () => ({
  resolveSession: vi.fn(),
}));
vi.mock("@/lib/services/change-email", () => ({
  confirmChangeEmail: vi.fn(),
}));

import { confirmChangeEmail } from "@/lib/services/change-email";
import { resolveSession } from "@/lib/services/session";
import { POST } from "./route";

const resolveSessionMock = vi.mocked(resolveSession);
const confirmChangeEmailMock = vi.mocked(confirmChangeEmail);

function requestWith(cookie: string | null, body: unknown): Request {
  return new Request("http://localhost:3000/api/auth/change-email/confirm", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      ...(cookie ? { cookie } : {}),
    },
    body: JSON.stringify(body),
  });
}

describe("POST /api/auth/change-email/confirm", () => {
  beforeEach(() => {
    resolveSessionMock.mockReset();
    confirmChangeEmailMock.mockReset();
  });

  it("returns 401 with no session cookie", async () => {
    const response = await POST(requestWith(null, { code: "123456" }));
    expect(response.status).toBe(401);
    expect(confirmChangeEmailMock).not.toHaveBeenCalled();
  });

  it("returns 400 invalid when code is missing", async () => {
    resolveSessionMock.mockResolvedValue({ userId: "user-1", sessionId: "s1" });

    const response = await POST(requestWith("session=good", {}));
    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({ success: false, reason: "invalid" });
  });

  it("returns 200 on success", async () => {
    resolveSessionMock.mockResolvedValue({ userId: "user-1", sessionId: "s1" });
    confirmChangeEmailMock.mockResolvedValue({ success: true });

    const response = await POST(requestWith("session=good", { code: "123456" }));

    expect(response.status).toBe(200);
    expect(confirmChangeEmailMock).toHaveBeenCalledWith("user-1", "123456");
  });

  it("returns 400 with the failure reason", async () => {
    resolveSessionMock.mockResolvedValue({ userId: "user-1", sessionId: "s1" });
    confirmChangeEmailMock.mockResolvedValue({ success: false, reason: "expired" });

    const response = await POST(requestWith("session=good", { code: "123456" }));

    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({ success: false, reason: "expired" });
  });
});

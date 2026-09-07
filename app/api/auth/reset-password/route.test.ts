import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/services/forgot-password", () => ({
  resetPassword: vi.fn(),
}));

import { resetPassword } from "@/lib/services/forgot-password";
import { POST } from "./route";

const resetPasswordMock = vi.mocked(resetPassword);

function jsonRequest(body: unknown): Request {
  return new Request("http://localhost:3000/api/auth/reset-password", {
    method: "POST",
    body: JSON.stringify(body),
    headers: { "content-type": "application/json" },
  });
}

describe("POST /api/auth/reset-password", () => {
  beforeEach(() => {
    resetPasswordMock.mockReset();
  });

  it("returns 400 invalid when a required field is missing", async () => {
    const response = await POST(jsonRequest({ email: "a@example.com", code: "123456" }));
    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({ success: false, reason: "invalid" });
    expect(resetPasswordMock).not.toHaveBeenCalled();
  });

  it("sets the session cookie and returns success on success", async () => {
    resetPasswordMock.mockResolvedValue({
      success: true,
      rawToken: "raw-session-token",
      expiresAt: new Date(),
    });

    const response = await POST(
      jsonRequest({ email: "a@example.com", code: "123456", newPassword: "a new password" }),
    );

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ success: true });
    expect(response.cookies.get("session")?.value).toBe("raw-session-token");
  });

  it("returns 400 with the failure reason", async () => {
    resetPasswordMock.mockResolvedValue({ success: false, reason: "expired" });

    const response = await POST(
      jsonRequest({ email: "a@example.com", code: "123456", newPassword: "a new password" }),
    );

    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({ success: false, reason: "expired" });
    expect(response.cookies.get("session")).toBeUndefined();
  });
});

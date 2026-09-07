import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/services/forgot-password", () => ({
  requestPasswordReset: vi.fn(),
}));

import { requestPasswordReset } from "@/lib/services/forgot-password";
import { POST } from "./route";

const requestPasswordResetMock = vi.mocked(requestPasswordReset);

function jsonRequest(body: unknown): Request {
  return new Request("http://localhost:3000/api/auth/forgot-password", {
    method: "POST",
    body: JSON.stringify(body),
    headers: { "content-type": "application/json" },
  });
}

describe("POST /api/auth/forgot-password", () => {
  beforeEach(() => {
    requestPasswordResetMock.mockReset();
  });

  it("returns 400 invalid when email is missing", async () => {
    const response = await POST(jsonRequest({}));
    expect(response.status).toBe(400);
    expect(requestPasswordResetMock).not.toHaveBeenCalled();
  });

  it("returns 200 success when the service succeeds", async () => {
    requestPasswordResetMock.mockResolvedValue({ success: true });

    const response = await POST(jsonRequest({ email: "a@example.com" }));

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ success: true });
    expect(requestPasswordResetMock).toHaveBeenCalledWith("a@example.com");
  });

  it("returns 429 when rate limited", async () => {
    requestPasswordResetMock.mockResolvedValue({ success: false, reason: "rate_limited" });

    const response = await POST(jsonRequest({ email: "a@example.com" }));

    expect(response.status).toBe(429);
    expect(await response.json()).toEqual({ success: false, reason: "rate_limited" });
  });
});

import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/repositories/user", () => ({
  findUserByEmail: vi.fn(),
}));
vi.mock("@/lib/services/verification", () => ({
  canResend: vi.fn(),
  issueOtp: vi.fn(),
}));

import { findUserByEmail } from "@/lib/repositories/user";
import { canResend, issueOtp } from "@/lib/services/verification";
import { POST } from "./route";

const findUserByEmailMock = vi.mocked(findUserByEmail);
const canResendMock = vi.mocked(canResend);
const issueOtpMock = vi.mocked(issueOtp);

function jsonRequest(body: unknown): Request {
  return new Request("http://localhost:3000/api/auth/resend-verification", {
    method: "POST",
    body: JSON.stringify(body),
    headers: { "content-type": "application/json" },
  });
}

describe("POST /api/auth/resend-verification", () => {
  beforeEach(() => {
    findUserByEmailMock.mockReset();
    canResendMock.mockReset();
    issueOtpMock.mockReset();
  });

  it("returns 400 invalid when email is missing", async () => {
    const response = await POST(jsonRequest({}));
    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({ success: false, reason: "invalid" });
  });

  it("pretends success for an unknown email - no enumeration", async () => {
    findUserByEmailMock.mockResolvedValue(null);

    const response = await POST(jsonRequest({ email: "nobody@example.com" }));

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ success: true });
    expect(issueOtpMock).not.toHaveBeenCalled();
  });

  it("returns 429 rate_limited when canResend is false", async () => {
    findUserByEmailMock.mockResolvedValue({
      id: "user-1",
      email: "a@example.com",
      emailVerifiedAt: null,
    });
    canResendMock.mockResolvedValue(false);

    const response = await POST(jsonRequest({ email: "a@example.com" }));

    expect(response.status).toBe(429);
    expect(await response.json()).toEqual({ success: false, reason: "rate_limited" });
    expect(issueOtpMock).not.toHaveBeenCalled();
  });

  it("issues a new OTP and returns success when allowed", async () => {
    findUserByEmailMock.mockResolvedValue({
      id: "user-1",
      email: "a@example.com",
      emailVerifiedAt: null,
    });
    canResendMock.mockResolvedValue(true);

    const response = await POST(jsonRequest({ email: "a@example.com" }));

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ success: true });
    expect(issueOtpMock).toHaveBeenCalledWith("user-1", "verify_email", "a@example.com");
  });
});

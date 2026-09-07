import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/repositories/user", () => ({
  findUserByEmail: vi.fn(),
  markEmailVerified: vi.fn(),
}));
vi.mock("@/lib/services/verification", () => ({
  verifyOtp: vi.fn(),
}));
vi.mock("@/lib/services/session", () => ({
  issueSession: vi.fn(),
}));

import { findUserByEmail, markEmailVerified } from "@/lib/repositories/user";
import { issueSession } from "@/lib/services/session";
import { verifyOtp } from "@/lib/services/verification";
import { POST } from "./route";

const findUserByEmailMock = vi.mocked(findUserByEmail);
const markEmailVerifiedMock = vi.mocked(markEmailVerified);
const verifyOtpMock = vi.mocked(verifyOtp);
const issueSessionMock = vi.mocked(issueSession);

function jsonRequest(body: unknown): Request {
  return new Request("http://localhost:3000/api/auth/verify", {
    method: "POST",
    body: JSON.stringify(body),
    headers: { "content-type": "application/json" },
  });
}

describe("POST /api/auth/verify", () => {
  beforeEach(() => {
    findUserByEmailMock.mockReset();
    markEmailVerifiedMock.mockReset();
    verifyOtpMock.mockReset();
    issueSessionMock.mockReset();
  });

  it("returns 400 invalid when email or code is missing", async () => {
    const response = await POST(jsonRequest({ email: "a@example.com" }));
    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({ success: false, reason: "invalid" });
  });

  it("returns a generic incorrect response for an unknown email - no enumeration", async () => {
    findUserByEmailMock.mockResolvedValue(null);

    const response = await POST(jsonRequest({ email: "nobody@example.com", code: "123456" }));

    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({ success: false, reason: "incorrect" });
    expect(verifyOtpMock).not.toHaveBeenCalled();
  });

  it("passes through the failure reason when verifyOtp fails", async () => {
    findUserByEmailMock.mockResolvedValue({
      id: "user-1",
      email: "a@example.com",
      emailVerifiedAt: null,
    });
    verifyOtpMock.mockResolvedValue({ success: false, reason: "expired" });

    const response = await POST(jsonRequest({ email: "a@example.com", code: "123456" }));

    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({ success: false, reason: "expired" });
    expect(markEmailVerifiedMock).not.toHaveBeenCalled();
    expect(issueSessionMock).not.toHaveBeenCalled();
  });

  it("marks email verified, issues a session, and sets the cookie on success", async () => {
    findUserByEmailMock.mockResolvedValue({
      id: "user-1",
      email: "a@example.com",
      emailVerifiedAt: null,
    });
    verifyOtpMock.mockResolvedValue({ success: true, newEmail: null });
    issueSessionMock.mockResolvedValue({
      rawToken: "raw-session-token",
      expiresAt: new Date(),
    });

    const response = await POST(jsonRequest({ email: "a@example.com", code: "123456" }));

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ success: true });
    expect(markEmailVerifiedMock).toHaveBeenCalledWith("user-1");
    expect(issueSessionMock).toHaveBeenCalledWith("user-1");
    expect(response.cookies.get("session")?.value).toBe("raw-session-token");
  });
});

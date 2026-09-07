import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/services/login", () => ({
  login: vi.fn(),
}));

import { login } from "@/lib/services/login";
import { POST } from "./route";

const loginMock = vi.mocked(login);

function jsonRequest(body: unknown): Request {
  return new Request("http://localhost:3000/api/auth/login", {
    method: "POST",
    body: JSON.stringify(body),
    headers: { "content-type": "application/json" },
  });
}

describe("POST /api/auth/login", () => {
  beforeEach(() => {
    loginMock.mockReset();
  });

  it("returns 400 invalid when email or password is missing", async () => {
    const response = await POST(jsonRequest({ email: "a@example.com" }));
    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({ success: false, reason: "invalid" });
    expect(loginMock).not.toHaveBeenCalled();
  });

  it("sets the session cookie and returns success on a successful login", async () => {
    loginMock.mockResolvedValue({
      success: true,
      rawToken: "raw-session-token",
      expiresAt: new Date(),
    });

    const response = await POST(jsonRequest({ email: "a@example.com", password: "correct" }));

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ success: true });
    expect(response.cookies.get("session")?.value).toBe("raw-session-token");
  });

  it("returns 401 invalid_credentials without setting a cookie on failure", async () => {
    loginMock.mockResolvedValue({ success: false, reason: "invalid_credentials" });

    const response = await POST(jsonRequest({ email: "a@example.com", password: "wrong" }));

    expect(response.status).toBe(401);
    expect(await response.json()).toEqual({ success: false, reason: "invalid_credentials" });
    expect(response.cookies.get("session")).toBeUndefined();
  });

  it("returns 429 for rate_limited", async () => {
    loginMock.mockResolvedValue({ success: false, reason: "rate_limited" });

    const response = await POST(jsonRequest({ email: "a@example.com", password: "wrong" }));

    expect(response.status).toBe(429);
    expect(await response.json()).toEqual({ success: false, reason: "rate_limited" });
  });
});

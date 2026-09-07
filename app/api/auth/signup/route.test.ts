import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/services/signup", () => ({
  signup: vi.fn(),
}));

import { signup } from "@/lib/services/signup";
import { POST } from "./route";

const signupMock = vi.mocked(signup);

function jsonRequest(body: unknown): Request {
  return new Request("http://localhost:3000/api/auth/signup", {
    method: "POST",
    body: JSON.stringify(body),
    headers: { "content-type": "application/json" },
  });
}

describe("POST /api/auth/signup", () => {
  beforeEach(() => {
    signupMock.mockReset();
  });

  it("returns 400 invalid when a required field is missing", async () => {
    const response = await POST(jsonRequest({ email: "a@example.com", password: "x" }));
    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({ success: false, reason: "invalid" });
    expect(signupMock).not.toHaveBeenCalled();
  });

  it("returns 200 success when the service succeeds", async () => {
    signupMock.mockResolvedValue({ success: true });

    const response = await POST(
      jsonRequest({ email: "a@example.com", password: "correct horse battery staple", timezone: "Asia/Kolkata" }),
    );

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ success: true });
    expect(signupMock).toHaveBeenCalledWith({
      email: "a@example.com",
      password: "correct horse battery staple",
      timezone: "Asia/Kolkata",
    });
  });

  it("returns 400 for a validation failure reason", async () => {
    signupMock.mockResolvedValue({ success: false, reason: "weak_password" });

    const response = await POST(
      jsonRequest({ email: "a@example.com", password: "short", timezone: "Asia/Kolkata" }),
    );

    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({ success: false, reason: "weak_password" });
  });

  it("returns 429 for a rate_limited reason", async () => {
    signupMock.mockResolvedValue({ success: false, reason: "rate_limited" });

    const response = await POST(
      jsonRequest({ email: "a@example.com", password: "correct horse battery staple", timezone: "Asia/Kolkata" }),
    );

    expect(response.status).toBe(429);
    expect(await response.json()).toEqual({ success: false, reason: "rate_limited" });
  });
});

import { afterEach, describe, expect, it, vi } from "vitest";

describe("session-cookie", () => {
  afterEach(() => {
    vi.resetModules();
    vi.unstubAllEnvs();
  });

  it("uses the plain cookie name and insecure flag outside production", async () => {
    vi.stubEnv("NODE_ENV", "development");
    const { SESSION_COOKIE_NAME, sessionCookieOptions } = await import("./session-cookie.ts");

    expect(SESSION_COOKIE_NAME).toBe("session");
    expect(sessionCookieOptions().secure).toBe(false);
  });

  it("uses the __Host- prefixed name and secure flag in production", async () => {
    vi.stubEnv("NODE_ENV", "production");
    const { SESSION_COOKIE_NAME, sessionCookieOptions } = await import("./session-cookie.ts");

    expect(SESSION_COOKIE_NAME).toBe("__Host-session");
    expect(sessionCookieOptions().secure).toBe(true);
  });

  it("sets maxAge to exactly 24 hours in seconds", async () => {
    const { sessionCookieOptions } = await import("./session-cookie.ts");
    expect(sessionCookieOptions().maxAge).toBe(86400);
  });

  it("clearedSessionCookieOptions sets maxAge to 0", async () => {
    const { clearedSessionCookieOptions } = await import("./session-cookie.ts");
    expect(clearedSessionCookieOptions().maxAge).toBe(0);
  });

  it("both option shapes are otherwise identical (httpOnly, sameSite, path)", async () => {
    const { sessionCookieOptions, clearedSessionCookieOptions } = await import(
      "./session-cookie.ts"
    );
    const active = sessionCookieOptions();
    const cleared = clearedSessionCookieOptions();

    expect(cleared.httpOnly).toBe(active.httpOnly);
    expect(cleared.sameSite).toBe(active.sameSite);
    expect(cleared.path).toBe(active.path);
  });
});

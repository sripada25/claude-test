import { afterEach, describe, expect, it, vi } from "vitest";
import { buildSecurityHeaders, generateNonce } from "./headers.ts";

describe("buildSecurityHeaders", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("local: CSP allows unsafe-eval/unsafe-inline, no HSTS", () => {
    vi.stubEnv("NODE_ENV", "development");

    const headers = buildSecurityHeaders("test-nonce");

    expect(headers["Content-Security-Policy"]).toContain("'unsafe-eval'");
    expect(headers["Content-Security-Policy"]).toContain("'unsafe-inline'");
    expect(headers["Strict-Transport-Security"]).toBeUndefined();
  });

  it("production: CSP uses a nonce only, no unsafe-eval, HSTS present", () => {
    vi.stubEnv("NODE_ENV", "production");

    const headers = buildSecurityHeaders("test-nonce");

    expect(headers["Content-Security-Policy"]).toContain("'nonce-test-nonce'");
    expect(headers["Content-Security-Policy"]).not.toContain("'unsafe-eval'");
    expect(headers["Content-Security-Policy"]).not.toContain("'unsafe-inline'");
    expect(headers["Strict-Transport-Security"]).toBe("max-age=63072000; includeSubDomains");
  });

  it("sets the environment-independent headers identically in both environments", () => {
    vi.stubEnv("NODE_ENV", "development");
    const local = buildSecurityHeaders("n1");
    vi.stubEnv("NODE_ENV", "production");
    const prod = buildSecurityHeaders("n1");

    for (const headers of [local, prod]) {
      expect(headers["X-Content-Type-Options"]).toBe("nosniff");
      expect(headers["Referrer-Policy"]).toBe("strict-origin-when-cross-origin");
      expect(headers["Permissions-Policy"]).toBe("camera=(), microphone=(), geolocation=()");
      expect(headers["X-Frame-Options"]).toBe("DENY");
    }
  });
});

describe("generateNonce", () => {
  it("produces a non-empty, distinct value each call", () => {
    const a = generateNonce();
    const b = generateNonce();

    expect(a).toBeTruthy();
    expect(b).toBeTruthy();
    expect(a).not.toBe(b);
  });
});

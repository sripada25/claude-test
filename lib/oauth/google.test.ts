import {
  type CryptoKey,
  SignJWT,
  createLocalJWKSet,
  exportJWK,
  generateKeyPair,
} from "jose";
import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";

const GOOGLE_ISSUER = "https://accounts.google.com";
const TEST_CLIENT_ID = "test-client-id";
const TEST_REDIRECT_URI = "http://localhost:3000/api/oauth/google/callback";

process.env.GOOGLE_CLIENT_ID = TEST_CLIENT_ID;
process.env.GOOGLE_CLIENT_SECRET = "test-client-secret";

// google.ts resolves Google's JWKS once at import time via createRemoteJWKSet.
// This box lets the mock below delegate to a locally-generated test keyset
// that isn't ready until beforeAll runs - the lookup happens lazily on each
// jwtVerify call, not at createRemoteJWKSet() call time, so the ordering works.
const jwksBox = vi.hoisted(() => ({ resolver: null as unknown as ReturnType<typeof createLocalJWKSet> }));

vi.mock("jose", async (importOriginal) => {
  const actual = await importOriginal<typeof import("jose")>();
  return {
    ...actual,
    createRemoteJWKSet: () => (...args: Parameters<ReturnType<typeof createLocalJWKSet>>) =>
      jwksBox.resolver(...args),
  };
});

describe("Google OIDC adapter", () => {
  let privateKey: CryptoKey;
  let google: typeof import("./google.ts");

  beforeAll(async () => {
    const { publicKey, privateKey: pk } = await generateKeyPair("RS256");
    privateKey = pk;

    const publicJwk = await exportJWK(publicKey);
    publicJwk.kid = "test-key-1";
    publicJwk.alg = "RS256";
    publicJwk.use = "sig";

    jwksBox.resolver = createLocalJWKSet({ keys: [publicJwk] });

    google = await import("./google.ts");
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  async function signIdToken(overrides: {
    sub?: string;
    email?: string;
    emailVerified?: boolean;
    name?: string;
    picture?: string;
    issuer?: string;
    audience?: string;
    expiresIn?: string;
  } = {}): Promise<string> {
    return new SignJWT({
      sub: overrides.sub ?? "google-sub-123",
      email: overrides.email ?? "user@example.com",
      email_verified: overrides.emailVerified ?? true,
      name: overrides.name ?? "Test User",
      picture: overrides.picture ?? "https://example.com/photo.jpg",
    })
      .setProtectedHeader({ alg: "RS256", kid: "test-key-1" })
      .setIssuedAt()
      .setIssuer(overrides.issuer ?? GOOGLE_ISSUER)
      .setAudience(overrides.audience ?? TEST_CLIENT_ID)
      .setExpirationTime(overrides.expiresIn ?? "1h")
      .sign(privateKey);
  }

  function mockTokenEndpoint(idToken: string | null, ok = true): void {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok,
        json: async () => ({ id_token: idToken }),
      }),
    );
  }

  it("builds an authorization URL with the correct params", () => {
    const url = new URL(
      google.buildGoogleAuthorizationUrl({
        state: "state-value",
        codeChallenge: "challenge-value",
        redirectUri: TEST_REDIRECT_URI,
      }),
    );

    expect(url.origin + url.pathname).toBe("https://accounts.google.com/o/oauth2/v2/auth");
    expect(url.searchParams.get("client_id")).toBe(TEST_CLIENT_ID);
    expect(url.searchParams.get("redirect_uri")).toBe(TEST_REDIRECT_URI);
    expect(url.searchParams.get("response_type")).toBe("code");
    expect(url.searchParams.get("scope")).toBe("openid profile email");
    expect(url.searchParams.get("state")).toBe("state-value");
    expect(url.searchParams.get("code_challenge")).toBe("challenge-value");
    expect(url.searchParams.get("code_challenge_method")).toBe("S256");
  });

  it("returns only sub/email/emailVerified/name for a validly-signed token", async () => {
    const idToken = await signIdToken();
    mockTokenEndpoint(idToken);

    const identity = await google.exchangeGoogleAuthorizationCode({
      code: "auth-code",
      codeVerifier: "verifier",
      redirectUri: TEST_REDIRECT_URI,
    });

    expect(identity).toEqual({
      sub: "google-sub-123",
      email: "user@example.com",
      emailVerified: true,
      name: "Test User",
    });
    expect(Object.keys(identity)).not.toContain("picture");
  });

  it("rejects a token with the wrong audience", async () => {
    const idToken = await signIdToken({ audience: "someone-elses-client-id" });
    mockTokenEndpoint(idToken);

    await expect(
      google.exchangeGoogleAuthorizationCode({
        code: "auth-code",
        codeVerifier: "verifier",
        redirectUri: TEST_REDIRECT_URI,
      }),
    ).rejects.toThrow();
  });

  it("rejects a token with the wrong issuer", async () => {
    const idToken = await signIdToken({ issuer: "https://evil.example.com" });
    mockTokenEndpoint(idToken);

    await expect(
      google.exchangeGoogleAuthorizationCode({
        code: "auth-code",
        codeVerifier: "verifier",
        redirectUri: TEST_REDIRECT_URI,
      }),
    ).rejects.toThrow();
  });

  it("rejects an expired token", async () => {
    const idToken = await signIdToken({ expiresIn: "-10s" });
    mockTokenEndpoint(idToken);

    await expect(
      google.exchangeGoogleAuthorizationCode({
        code: "auth-code",
        codeVerifier: "verifier",
        redirectUri: TEST_REDIRECT_URI,
      }),
    ).rejects.toThrow();
  });

  it("rejects when the token endpoint responds non-OK, without attempting verification", async () => {
    mockTokenEndpoint(null, false);

    await expect(
      google.exchangeGoogleAuthorizationCode({
        code: "auth-code",
        codeVerifier: "verifier",
        redirectUri: TEST_REDIRECT_URI,
      }),
    ).rejects.toThrow("Google token exchange failed");
  });
});

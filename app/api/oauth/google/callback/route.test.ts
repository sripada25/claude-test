import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/services/oauth-google-signin", () => ({
  completeGoogleSignIn: vi.fn(),
}));

describe("GET /api/oauth/google/callback", () => {
  let GET_: typeof import("./route.ts")["GET"];
  let completeGoogleSignIn: ReturnType<typeof vi.fn>;

  beforeAll(async () => {
    process.env.NEXT_PUBLIC_APP_URL = "http://localhost:3000";
    ({ GET: GET_ } = await import("./route.ts"));
    ({ completeGoogleSignIn } = (await import("@/lib/services/oauth-google-signin")) as unknown as {
      completeGoogleSignIn: ReturnType<typeof vi.fn>;
    });
  });

  afterEach(() => {
    vi.mocked(completeGoogleSignIn).mockReset();
  });

  function requestWithCookies(params: {
    query: string;
    stateCookie?: string;
  }): Request {
    const headers: Record<string, string> = {};
    if (params.stateCookie) {
      headers.cookie = `oauth_state=${params.stateCookie}`;
    }
    return new Request(`http://localhost:3000/api/oauth/google/callback${params.query}`, {
      headers,
    });
  }

  it("on success, sets the session cookie, clears OAuth cookies, and redirects to /", async () => {
    vi.mocked(completeGoogleSignIn).mockResolvedValue({
      success: true,
      rawToken: "raw-session-token",
      expiresAt: new Date(Date.now() + 86_400_000),
    });

    const response = await GET_(
      requestWithCookies({ query: "?code=abc&state=xyz", stateCookie: "xyz" }),
    );

    expect(response.status).toBe(307);
    expect(new URL(response.headers.get("location") ?? "").pathname).toBe("/");
    expect(response.cookies.get("session")?.value).toBe("raw-session-token");
    expect(response.cookies.get("oauth_state")?.value).toBe("");
    expect(response.cookies.get("oauth_tz")?.value).toBe("");
  });

  it("on failure, clears OAuth cookies and redirects to /signin with the reason, no session cookie", async () => {
    vi.mocked(completeGoogleSignIn).mockResolvedValue({
      success: false,
      reason: "email_not_verified",
    });

    const response = await GET_(
      requestWithCookies({ query: "?code=abc&state=xyz", stateCookie: "xyz" }),
    );

    const location = new URL(response.headers.get("location") ?? "");
    expect(location.pathname).toBe("/signin");
    expect(location.searchParams.get("oauth_error")).toBe("email_not_verified");
    expect(response.cookies.get("session")?.value ?? "").toBe("");
    expect(response.cookies.get("oauth_state")?.value).toBe("");
  });

  it("redirects with oauth_error=denied when Google reports an error, without calling the service", async () => {
    const response = await GET_(requestWithCookies({ query: "?error=access_denied" }));

    const location = new URL(response.headers.get("location") ?? "");
    expect(location.searchParams.get("oauth_error")).toBe("denied");
    expect(completeGoogleSignIn).not.toHaveBeenCalled();
  });
});

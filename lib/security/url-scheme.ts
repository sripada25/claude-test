const ALLOWED_SCHEMES = new Set(["http:", "https:"]);

// Static scheme check only - never fetches the URL server-side (L081/G9).
// An unguarded fetch of a user-supplied URL is an SSRF path to cloud
// metadata endpoints or internal services.
export function isAllowedUrlScheme(url: string): boolean {
  try {
    return ALLOWED_SCHEMES.has(new URL(url).protocol);
  } catch {
    return false;
  }
}

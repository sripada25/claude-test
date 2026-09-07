import { randomBytes } from "node:crypto";

export function generateNonce(): string {
  return randomBytes(16).toString("base64");
}

// SECURITY_quarterfinal.md §5. CSP violations don't surface in dev mode
// (Next needs unsafe-eval for hot reload) - verify with `next build && next
// start` before trusting the production policy.
export function buildSecurityHeaders(nonce: string): Record<string, string> {
  const isProd = process.env.NODE_ENV === "production";

  const scriptSrc = isProd ? `'self' 'nonce-${nonce}'` : "'self' 'unsafe-eval' 'unsafe-inline'";
  const styleSrc = isProd ? `'self' 'nonce-${nonce}'` : "'self' 'unsafe-inline'";

  const csp = [
    "default-src 'self'",
    `script-src ${scriptSrc}`,
    `style-src ${styleSrc}`,
    "img-src 'self' data:",
    "font-src 'self' data:",
    "connect-src 'self'",
  ].join("; ");

  const headers: Record<string, string> = {
    "Content-Security-Policy": csp,
    "X-Content-Type-Options": "nosniff",
    "Referrer-Policy": "strict-origin-when-cross-origin",
    "Permissions-Policy": "camera=(), microphone=(), geolocation=()",
    "X-Frame-Options": "DENY",
  };

  // Never from localhost - it poisons the browser's HSTS cache for every
  // project on that host, not just this one.
  if (isProd) {
    headers["Strict-Transport-Security"] = "max-age=63072000; includeSubDomains";
  }

  return headers;
}

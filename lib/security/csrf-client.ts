// Browser-side counterpart to lib/security/csrf.ts (T7.2). The CSRF cookie
// is deliberately not httpOnly so this can read it - every state-changing
// fetch() from client code must echo it back as this header, or proxy.ts
// rejects the request with 403 before it reaches the route handler.
const CSRF_COOKIE_NAME = process.env.NODE_ENV === "production" ? "__Host-csrf" : "csrf";
export const CSRF_HEADER_NAME = "x-csrf-token";

export function getCsrfToken(): string {
  const match = document.cookie.match(new RegExp(`(?:^|; )${CSRF_COOKIE_NAME}=([^;]+)`));
  return match ? decodeURIComponent(match[1]) : "";
}

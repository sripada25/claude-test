# SECURITY.md — Trackr

Mapped to **OWASP Top 10:2025** (announced November 2025, finalised January 2026 — the first revision since 2021, built on 175,000+ CVEs).

This supersedes ad-hoc security notes in `FEATURE-A-SPEC.md` §6. That table stays valid; this document finds what it **missed**.

---

# 1 · WHAT CHANGED IN 2025 — AND WHY IT MATTERS TO YOU

Two categories are new, one was absorbed:

| | Category | Relevance to Trackr |
|---|---|---|
| **A01** | Broken Access Control — **now absorbs SSRF**, explicitly covers BOLA/BFLA | 🔴 Highest. No Supabase RLS (L023) means every check is your code |
| **A02** | Security Misconfiguration — **jumped #5 → #2** | 🔴 **Not covered at all in the F1 spec** |
| **A03** | **Software Supply Chain Failures — NEW** | 🔴 **Not covered.** Highest exploit/impact scores of any category |
| **A09** | Security Logging & **Alerting** Failures (renamed) | 🟡 Partially — we have "don't log secrets", no positive requirement |
| **A10** | **Mishandling of Exceptional Conditions — NEW** | 🔴 **Not covered.** Failing open, error handling |

> A01 remains #1 and now has the most mapped CWEs of any category — authorization logic stays fragile across frameworks and APIs.

> A03 begins on the developer workstation, not in production: malicious packages, compromised maintainers, tampered builds.

---

# 2 · GAPS FOUND — ordered by severity

## 🔴 G1 — OAuth `state` and PKCE missing entirely (A01, A08)

SSO was added yesterday (L068). The spec has **no CSRF protection on the OAuth flow**.

Without a `state` parameter, an attacker can complete an OAuth flow and have the victim's browser land on the callback with the **attacker's** authorization code — silently linking the victim's Trackr session to the attacker's Google account.

**Required:**
- Cryptographically random `state`, stored server-side against the session, verified on callback, single use, 10-minute expiry
- **PKCE** (`code_challenge` / `code_verifier`) even for confidential clients — now standard in OAuth 2.1
- **Exact redirect URI matching.** LinkedIn requires byte-for-byte matching including scheme and trailing path; hold Google to the same standard
- Never accept a `redirect_to` from the query string without allow-listing it (open redirect)

## 🔴 G2 — Failing open (A10, new category)

**The question the spec never asks: if the session middleware throws an exception, does the request get denied or allowed?**

A10 covers 24 CWEs on improper error handling, logical errors, and failing open.

**Required:**
- Session middleware `catch` → **deny**, always. Never `next()` on error
- Database unreachable → 503, never "assume authorized"
- AI provider timeout mid-generation → quota **not** decremented, no partial document saved
- Rate limiter unavailable → **deny** the login attempt, don't skip the check
- Every `try/catch` in an auth path defaults to the restrictive branch

**This class of bug doesn't show up in normal testing** — it only appears when a dependency fails, which is exactly when you're not watching.

## 🔴 G3 — Supply chain unaddressed (A03, new category)

**Required:**
- `package-lock.json` committed; `npm ci` in the Dockerfile, never `npm install`
- **Verify every package exists on npm before adding it.** AI-suggested package names that don't exist ("slopsquatting") are a live attack vector — attackers register the hallucinated names
- `npm audit` in CI, build fails on high/critical
- Pin base images by digest, not tag: `node:24-alpine@sha256:...`
- Enable Dependabot on the private repo
- Prefer zero-dependency packages for anything security-critical

## 🔴 G4 — Security headers absent (A02, now #2)

Nothing in the spec sets headers. Add via Next.js middleware:

```
Content-Security-Policy      default-src 'self'; frame-ancestors 'none'
Strict-Transport-Security    max-age=63072000; includeSubDomains   (production only)
X-Content-Type-Options       nosniff
Referrer-Policy              strict-origin-when-cross-origin
Permissions-Policy           camera=(), microphone=(), geolocation=()
```

Also: disable `X-Powered-By`, and never return stack traces to clients in production.

## 🟠 G5 — CSRF only partly handled

`SameSite=Lax` (L044) blocks most cross-site POSTs, but it isn't complete — and **`Strict` is not an option** because it breaks the OAuth callback (Google's redirect is cross-site).

**Required:** double-submit token on state-changing routes, plus `Origin`/`Referer` validation on all POST/PUT/DELETE.

## 🟠 G6 — Signup leaks account existence

The spec hardens `/login` against enumeration but not `/signup`. If signup returns *"email already registered"*, the enumeration is back through the other door.

**Required:** signup returns the same success response either way, and sends a *"someone tried to register with your address"* email to the existing account.

## 🟠 G7 — OTP comparison and timing

L071 defines OTP well but omits:
- **Constant-time comparison** of the OTP hash — a naive `===` leaks position information
- Lock the *account's* verification, not just the token, after 5 failures
- Invalidate all outstanding OTPs when a new one is issued

## 🟠 G8 — No security event logging or alerting (A09)

The rename to "Alerting" is deliberate: great logging with no alerting is of minimal value for identifying incidents.

**Required — a `security_events` table** capturing: failed logins, password invalidated by OAuth linking (L069), email changes, OTP lockouts, rate-limit trips, permission-denied responses.

Fields: `event_type`, `user_id` (nullable), `ip`, `user_agent`, `created_at`, `metadata` JSONB.
**Never** log passwords, OTPs, tokens, or resume contents.

## 🟡 G9 — SSRF is coming in F2 (A01)

F2's application record has a `source_url` field. **The moment anything server-side fetches that URL, you have SSRF** — an attacker submits `http://169.254.169.254/` (cloud metadata) or `http://localhost:5432`.

**Decision for F2:** either never fetch `source_url` server-side (store and display only), or allow-list schemes, resolve DNS first, and block private IP ranges. Recommend the former.

## 🟡 G10 — File upload hardening

Resume upload (`/api/profile/parse-resume`) needs:
- **Magic-byte validation** (`%PDF-`), not just the `Content-Type` header
- Size cap ~10 MB, enforced before reading into memory
- Page-count cap before sending to the AI provider (cost control + DoS)
- Never written to disk (already L064) — memory only, discarded after
- Explicit rejection of encrypted/password-protected PDFs rather than a crash (A10)

---

# 3 · COOKIES & SESSIONS — local vs production

Your question: *"are you planning to setup cookies and session management securely in local machine?"* Yes, and here's the exact plan.

| Attribute | Local | Production | Note |
|---|---|---|---|
| `httpOnly` | ✅ | ✅ | Never JS-readable |
| `Secure` | ❌ | ✅ | `NODE_ENV === 'production'` — HTTP localhost can't set it |
| `SameSite` | `Lax` | `Lax` | **Not `Strict`** — breaks OAuth callback |
| `Path` | `/` | `/` | |
| Name prefix | plain | `__Host-` | Browser-enforced; requires `Secure` + `Path=/` + no `Domain` |
| Max-Age | 30d | 30d | |

**Identical everywhere:** token is 32 random bytes, stored **hashed** server-side, rotated on login (session fixation), revoked server-side on logout, and validated against `expires_at` + `revoked_at` on every request.

**Only the two flags differ, and both are derived from `NODE_ENV`** — no code changes at deploy.

---

# 4 · WILL THIS SURVIVE THE MOVE TO PRODUCTION?

**Yes.** The security code you write locally is the security code that runs in production. Unchanged.

**Why this is a clean yes, not a qualified one:** every control in this document is *application-layer* — it lives in your code, inside the container. Railway (or any host) neither provides nor interferes with any of it. The Dockerfile guarantees the same image runs in both places, so the same code executes with the same behaviour.

Three buckets, and only one involves any work at deploy time:

### 4.1 Travels unchanged — zero work

Auth logic · session issue/validate/revoke · every authorization check · input validation · OTP generation and verification · fail-closed error handling (G2) · CSRF tokens · OAuth `state` and PKCE (G1) · security header middleware (G4) · upload validation (G10) · `security_events` logging (G8) · rate limiting.

That is essentially the entire threat model. **None of it is rewritten, re-tuned, or re-tested at deploy.**

### 4.2 Config-only — env var changes, no code

| Setting | Local | Production | Mechanism |
|---|---|---|---|
| `Secure` cookie flag | off | on | `NODE_ENV` |
| `__Host-` cookie prefix | off | on | `NODE_ENV` |
| HSTS header | off | on | `NODE_ENV` |
| SMTP credentials | Mailpit | Brevo | env var |
| Payment keys | test mode | live | env var |
| OAuth redirect URIs | `localhost` | + production URL | provider console — **add, don't replace** |
| Gemini key | free tier | paid (L057) | env var |

Every one of these is already an env var in `.env.example`. **No file is edited to deploy.**

### 4.3 Cannot be verified until deployed — new checks, not rework

These are things that *don't exist* locally, so there's nothing to get wrong in code:

- **TLS certificate chain** — Railway terminates TLS; there's no local equivalent
- **Email deliverability** — SPF, DKIM, DMARC alignment and sender reputation only exist against a real domain. **This is the one to watch**, because L038 Option B (sending with `Reply-To:` the user's address) is exactly the pattern that lands in spam when DKIM is misaligned
- **Proxy header handling** — behind Railway's proxy, client IP arrives in `X-Forwarded-For`. Your rate limiter must read it correctly, or it limits *the proxy* instead of the attacker. **Write this as configurable from day one** — it's the one item in this list that touches code
- **Load behaviour** — rate limits and connection pooling under real concurrency

### 4.4 The actual risk — and it isn't the platform move

The failure mode isn't "code doesn't transfer." It's **skipping these controls now and adding them after launch.** By then there is real user data sitting behind the gap, and retrofitting `state` into an OAuth flow or fail-closed logic into middleware means touching auth code that's already handling live sessions.

Build them now and deployment is a configuration change. That is the whole point of L043 and L025.

---

# 5 · WHAT'S DELIBERATELY DEFERRED

| Item | Why | When |
|---|---|---|
| WAF | Overkill pre-traffic | Post-launch if abused |
| MFA/TOTP | SSO covers most of the need | Post-MVP |
| Penetration test | Nothing deployed yet | Before public launch |
| Automated DAST | No running target | With staging |
| Bug bounty | No users | Much later |

---

# 6 · REQUIRED SECURITY TESTS

Each must exist before F1 is called done:

1. IDOR — user A cannot read/write user B's profile via any endpoint
2. Login enumeration — identical response and timing for unknown email vs wrong password
3. **Signup enumeration** (G6)
4. Brute force — rate limiter blocks after N attempts
5. **Pre-registration takeover (L069)** — unverified password account + Google sign-in ⇒ old password dead
6. **OAuth `state` mismatch is rejected** (G1)
7. **Session middleware throwing ⇒ request denied, not allowed** (G2)
8. Mass assignment — `tier` and `user_id` unwritable via `PUT /api/profile`
9. Upload — non-PDF, oversized, and encrypted PDFs all rejected cleanly (G10)
10. OTP — expired, wrong, and over-attempt cases; lockout holds
11. Session revocation — logged-out token rejected immediately
12. Cascade delete — removing a user leaves no orphans

---

*Cite this document rather than re-deriving. Threat model reviewed against OWASP Top 10:2025 on 2026-08-25.*

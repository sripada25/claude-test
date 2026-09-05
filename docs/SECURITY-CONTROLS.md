# SECURITY-CONTROLS.md — Trackr

The ten gaps from `SECURITY.md` §2, resolved into **implementable rules**, each stated separately for local and production.

---

# 0 · THE GOVERNING PRINCIPLE

> **Security *behaviour* is identical in local and production. Only security *configuration* differs.**

If a control behaves differently in the two environments, you are testing something other than what you ship. The legitimate differences are narrow and listed in §12.

**The one thing that may differ:** error *detail*. Locally you may see a stack trace; in production the client sees a generic message. **The decision — allow or deny — is never environment-dependent.**

```
❌ if (isLocal) { skipRateLimit() }        ← now untested in the only place it matters
❌ if (isLocal) { allowOnSessionError() }  ← ships a fail-open path
✅ const secure = process.env.NODE_ENV === 'production'
```

---

# 1 · G1 — OAuth `state` + PKCE

**Rule:** every OAuth flow carries a cryptographically random, single-use `state` and a PKCE `code_verifier`. The callback rejects any mismatch, absence, reuse, or expiry.

| | Local | Production |
|---|---|---|
| `state` generation | `crypto.randomBytes(32)` | identical |
| Storage | `oauth_states` table | identical |
| Expiry | 10 minutes | identical |
| Single use | delete on consume | identical |
| **State cookie `Secure`** | ❌ off | ✅ on |
| **State cookie `SameSite`** | `Lax` | `Lax` — **never `Strict`**, it drops the cookie on Google's cross-site redirect |
| Redirect URI | `http://localhost:3000/api/oauth/google/callback` | `https://<domain>/api/oauth/google/callback` |

**Register both redirect URIs in the Google console — add, never replace.** Otherwise local development breaks the moment you deploy.

**Never accept `redirect_to` from a query string.** If post-login destinations are needed, allow-list paths server-side.

**Verify:** security test #6 — tamper with `state`, assert the callback is rejected.

---

# 2 · G2 — Fail closed (OWASP A10)

**Rule:** every catch block in an authentication or authorization path returns denial. No exceptions, no environment variation.

| Failure | Response — both environments |
|---|---|
| Session middleware throws | **401** |
| Database unreachable during session lookup | **401**, not 500, not pass-through |
| Rate limiter unavailable | **deny the attempt** |
| OAuth provider returns malformed data | **reject the login** |
| AI provider times out mid-generation | quota **not** decremented, no partial document saved |
| Migration incomplete at boot | **refuse to start** |

**This is the one gap where a local shortcut is genuinely dangerous.** A developer who adds "allow through on DB error so I can keep working" ships a fail-open authentication path. If the database is down locally, fix the database.

**Verify:** security test #7 — inject a failure into session resolution, assert denial.

---

# 3 · G3 — Supply chain (OWASP A03)

| | Local | Production build |
|---|---|---|
| Install | `npm ci` | `npm ci --omit=dev` |
| Lockfile | committed | identical, never regenerated in CI |
| Base image | `node:24-alpine@sha256:...` | identical digest |
| New packages | `npm view <pkg>` **before** adding | none added at build time |
| Audit | `npm audit` before each PR | CI fails on high/critical |

**Before any package enters `package.json`:**
1. `npm view <package>` — an error means it doesn't exist
2. Check weekly downloads and last publish date
3. Confirm the repository link resolves
4. **Ask before adding** anything not already present

OWASP's new A03 explicitly covers AI-suggested packages that don't exist. Attackers register those names and wait.

**Production image must not contain dev dependencies, source maps, or the `.git` directory.**

---

# 4 · G4 — Security headers (OWASP A02, now #2)

Set in Next.js middleware, gated only where genuinely necessary.

| Header | Local | Production |
|---|---|---|
| `Content-Security-Policy` | `'self' 'unsafe-eval' 'unsafe-inline'` | `'self'` + nonce |
| `Strict-Transport-Security` | ❌ omitted | `max-age=63072000; includeSubDomains` |
| `X-Content-Type-Options` | `nosniff` | `nosniff` |
| `Referrer-Policy` | `strict-origin-when-cross-origin` | identical |
| `Permissions-Policy` | `camera=(), microphone=(), geolocation=()` | identical |
| `X-Frame-Options` | `DENY` | `DENY` |
| `X-Powered-By` | removed | removed |

**Two justified differences:**

**CSP** — Next.js dev mode requires `unsafe-eval` for hot reload. Without it, local development doesn't work. Production uses the strict policy.

⚠️ **This means CSP violations only surface in production.** Mitigate by running `npm run build && npm start` locally at least once before deploying — that exercises the production CSP on your machine.

**HSTS** — instructs browsers to refuse HTTP for the domain. Sent on `localhost` it can poison your browser's HSTS cache and break local development across every project on that host. **Production only.**

---

# 5 · G5 — CSRF

| | Local | Production |
|---|---|---|
| Double-submit token | ✅ | ✅ |
| `Origin`/`Referer` validation | ✅ | ✅ |
| Allowed origins | `http://localhost:3000` | `https://<domain>` |
| Source | `NEXT_PUBLIC_APP_URL` | same variable |

Same code, same enforcement. Only the allow-list value changes, and it comes from an env var already in `.env.example`.

`SameSite=Lax` handles most cases but is not sufficient alone — and `Strict` isn't available to you because it breaks the OAuth callback (§1).

---

# 6 · G6 — Signup enumeration

**Rule:** signup returns an identical response whether or not the email is already registered.

- Existing account → send a *"someone tried to register with your address"* email; return success
- New account → create it; return success
- **Identical status code, identical body, comparable timing**

No environment difference. **Locally, both paths land in Mailpit** — which is exactly how you verify the behaviour is right.

**Watch for the leak reappearing through error handling:** an unhandled `UNIQUE` violation surfaces as `duplicate key value violates unique constraint "users_email_key"`. Catch constraint violations in the repository and translate them (`DATABASE-SECURITY.md` §7).

**Verify:** security test #3.

---

# 7 · G7 — OTP handling

| Parameter | Local | Production |
|---|---|---|
| Generation | `crypto.randomInt` — **never `Math.random`** | identical |
| Length | 6 digits | identical |
| Storage | hashed | identical |
| Expiry | 10 minutes | identical |
| Max attempts | 5, then invalidate | identical |
| Resend limit | 3/hour | identical |
| Comparison | constant-time | identical |
| Delivery | Mailpit `:8025` | Brevo |
| **Logging the OTP** | ❌ never | ❌ never |

**No shortcuts locally.** You don't need to log OTPs — Mailpit shows the email. A `console.log(otp)` added "temporarily" is how OTPs end up in production logs.

Invalidate all outstanding OTPs when a new one is issued. Distinguish *"expired — resend"* from *"incorrect — N attempts remaining"*.

**Verify:** security test #10.

---

# 8 · G8 — Security events (OWASP A09)

| | Local | Production |
|---|---|---|
| Events written | ✅ all | ✅ all |
| Retention | until you reset the DB | ≥90 days |
| **Alerting** | ❌ none | ✅ required |

OWASP renamed this category to include *Alerting* deliberately — logging without alerting has minimal value for identifying an incident.

**Minimum production alerting** (email is sufficient at your scale):
- More than N `rate_limit_tripped` in an hour
- Any `password_invalidated_by_oauth_link` — either a takeover attempt or a bug
- Any `oauth_state_mismatch` — no legitimate cause
- Failed login rate above baseline

**Never in `metadata`:** passwords, OTPs, tokens, resume content.

---

# 9 · G9 — SSRF (deferred to F2)

**Decision, made now so F2 inherits it:** `applications.source_url` is **stored and displayed, never fetched server-side.**

If a future feature needs to fetch it: allow-list schemes to `http`/`https`, resolve DNS first, block private and link-local ranges (`10.*`, `172.16-31.*`, `192.168.*`, `127.*`, `169.254.*`), disable redirect following, set a timeout.

**`169.254.169.254` is the cloud metadata endpoint.** On a hosted platform, an unguarded server-side fetch of user-supplied URLs can expose infrastructure credentials. Same risk locally — Docker networking makes `localhost:5432` reachable from the app container.

---

# 10 · G10 — File upload

| Control | Local | Production |
|---|---|---|
| Magic bytes (`%PDF-`) | ✅ | ✅ |
| Reject on `Content-Type` alone | ❌ never trusted | ❌ never trusted |
| Size cap | 10 MB, before buffering | identical |
| Page-count cap | before sending to AI | identical |
| Written to disk | ❌ never | ❌ never |
| Encrypted PDF | reject cleanly, don't crash (A10) | identical |

Buffer in memory, send to the provider, discard. Nothing touches disk or R2 during parsing (L064).

**Verify:** security test #9.

---

# 11 · COMPLETE ENVIRONMENT MATRIX

Everything that differs, in one place. **If it isn't here, it must not differ.**

| Setting | Local | Production | Source |
|---|---|---|---|
| `NODE_ENV` | `development` | `production` | env |
| Cookie `Secure` | off | on | `NODE_ENV` |
| Cookie `__Host-` prefix | off | on | `NODE_ENV` |
| HSTS header | omitted | sent | `NODE_ENV` |
| CSP | `unsafe-eval` allowed | strict + nonce | `NODE_ENV` |
| Error detail to client | verbose | generic | `NODE_ENV` |
| Trust proxy headers | ❌ off | ✅ on | `TRUST_PROXY` env |
| Email transport | Mailpit | Brevo | `EMAIL_TRANSPORT` |
| Gemini key | free tier | **paid** (L057) | env |
| Payment keys | test mode | live | env |
| OAuth redirect | `localhost` | domain | provider console |
| Allowed CSRF origin | `localhost:3000` | domain | `NEXT_PUBLIC_APP_URL` |
| Security alerting | off | on | `ALERT_EMAIL` |
| Log level | `debug` | `info` | `LOG_LEVEL` |

**Fourteen rows. Every one is an env var or derived from `NODE_ENV`.** No code path differs.

---

# 12 · DEPLOYING THE CONTAINER

Platform-independent, because the Dockerfile is (L043).

## 12.1 The container contract

Your image must:

1. **Listen on `process.env.PORT`** — Railway and most platforms inject it. Hardcoding 3000 means the health check never passes and the deploy silently fails
2. **Bind `0.0.0.0`, not `127.0.0.1`** — otherwise nothing outside the container can reach it
3. **Expose a health endpoint** — `GET /api/health` returning 200 without touching the database
4. **Read `DATABASE_URL` from the environment** — platforms inject it
5. **Run as a non-root user**
6. **Fail fast on missing env vars** — crash at boot, not during a user's signup

## 12.2 Trust proxy — the one code change

Behind a platform proxy, every request appears to come from the proxy. Your rate limiter would count all attackers as one client.

```
TRUST_PROXY=false   local   → read the socket address
TRUST_PROXY=true    prod    → read the first entry of X-Forwarded-For
```

⚠️ **Never trust `X-Forwarded-For` unconditionally.** Without a proxy in front, a client can forge it and bypass rate limiting entirely. Gate it on the env var, and set it only where a proxy actually exists.

**This is the single item in this document that requires code, not just configuration. Write it configurable from day one.**

## 12.3 Pre-deploy checklist

- [ ] `npm run build && npm start` locally — exercises the **production** CSP (§4)
- [ ] `docker build .` succeeds
- [ ] Container runs with only production env vars set
- [ ] `/api/health` responds
- [ ] `npm audit` clean of high/critical
- [ ] No secrets in the image: `docker history --no-trunc <image>`
- [ ] Migrations tested up **and down**
- [ ] **Verify production Postgres major version matches local**

## 12.4 Deploy sequence

1. Provision Postgres, capture `DATABASE_URL`
2. Set every env var from §11 — **including a fresh `SESSION_SECRET`, never the local one**
3. Add the production OAuth redirect URI (add, don't replace)
4. Deploy the image
5. Run migrations
6. Verify `/api/health`

## 12.5 Post-deploy verification

These cannot be tested locally — check them once, immediately:

- [ ] **TLS** — SSL Labs, expect A
- [ ] **Headers** — securityheaders.com; confirm HSTS present and CSP is the strict one
- [ ] **Proxy headers** — log the resolved client IP on one request; **if it's the proxy's IP, your rate limiter is broken**
- [ ] **Email** — send a verification to mail-tester.com; confirm SPF, DKIM, DMARC all pass
- [ ] **Smoke test** — signup → OTP → login → logout → delete account
- [ ] **Fail-closed spot check** — stop the database briefly; authenticated requests must return 401, not 500 or success

## 12.6 Railway specifics

- `PORT` and `DATABASE_URL` are injected — read them, don't set them
- The Dockerfile takes priority over the platform's default builder (L021a)
- Set `TRUST_PROXY=true` — Railway sits behind a proxy
- Secrets are set in the dashboard, never committed

## 12.7 Generic VPS specifics

- **Caddy** over nginx — automatic TLS, far less configuration
- Set `TRUST_PROXY=true` and configure Caddy to send `X-Forwarded-For`
- `docker compose` with app + Postgres + Caddy
- Firewall: expose 80 and 443 only. **Postgres must never be reachable from the internet**

---

# 13 · STATUS

All ten gaps resolved. `SECURITY.md` §2 now describes *what was wrong*; this document describes *what is being built*.

| Gap | Resolved as | Code differs by environment? |
|---|---|---|
| G1 OAuth state/PKCE | §1 | No — cookie flags only |
| G2 Fail closed | §2 | **No — never** |
| G3 Supply chain | §3 | Build flags only |
| G4 Headers | §4 | CSP + HSTS via `NODE_ENV` |
| G5 CSRF | §5 | Origin value only |
| G6 Signup enumeration | §6 | No |
| G7 OTP | §7 | Transport only |
| G8 Security events | §8 | Alerting only |
| G9 SSRF | §9 | No — deferred to F2 |
| G10 Upload | §10 | No |

**One item requires code: trust-proxy handling (§12.2).** Everything else is configuration.

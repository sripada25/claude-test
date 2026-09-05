# TASKS.md — Feature A (User Accounts)

One task → one branch → one PR. Branch name is the task ID (see `GIT.md`).
Task specification template in `TASK-REFERENCE.md`. Completion report template in `REPORTS.md`.

**Status key:** ⬜ not started · 🟦 in progress · ✅ done · ⏸ blocked

---

## Dependency order

```
P1 Data foundation
      ↓
P2 Auth core ───────────┐
      ↓                 │
P3 Auth API        P4 SSO
      ↓                 │
      └────────┬────────┘
               ↓
      P5 Profile + AI
               ↓
      P6 Subscription (read-only)
               ↓
      P7 Security hardening
               ↓
      P8 Frontend  ⏸ blocked on wireframes
```

Do not start a task until its dependencies are **merged**, not merely approved (L022 completion-state rule).

---

## P1 — Data foundation

| ID | Task | Depends | Reads | Status |
|----|------|---------|-------|--------|
| T1.1 | Migration tooling + reversible baseline | — | `DATABASE.md` | ⬜ |
| T1.2 | `users` table · citext + pgcrypto extensions | T1.1 | `DATABASE.md` §2.1 | ⬜ |
| T1.3 | `profiles` table · enums · salary CHECK | T1.2 | `DATABASE.md` §2.2 | ⬜ |
| T1.4 | `sessions` table + partial index | T1.2 | `DATABASE.md` §2.3 | ⬜ |
| T1.5 | `verification_tokens` + `email_log` | T1.2 | `DATABASE.md` §2.4 | ⬜ |
| T1.6 | `oauth_accounts` table | T1.2 | `DATABASE.md` §2.5 | ⬜ |
| T1.7 | `subscriptions` + `generation_quota` | T1.2 | `DATABASE.md` §2.6 | ⬜ |
| T1.8 | `auth_attempts` + `security_events` | T1.1 | `DATABASE.md` §2.7 | ⬜ |
| T1.9 | **`oauth_states`** — required by T4.1; without it `state` cannot be verified | T1.2 | `DATABASE.md` §2.5 | ⬜ |

## P2 — Auth core

| ID | Task | Depends | Reads | Status |
|----|------|---------|-------|--------|
| T2.1 | Argon2id hash/verify module | T1.2 | `SECURITY.md` | ⬜ |
| T2.2 | Session service — issue / resolve / revoke, token hashed at rest | T1.4 | `FEATURE-A-SPEC.md` §6 | ⬜ |
| T2.3 | **Session middleware — sole identity chokepoint, fails closed** | T2.2 | `SECURITY.md` G2 | ⬜ |
| T2.4 | Postgres rate limiter — configurable client-IP source | T1.8 | `SECURITY.md` §4.3 | ⬜ |
| T2.5 | Security event logger | T1.8 | `SECURITY.md` G8 | ⬜ |

## P3 — Auth API

| ID | Task | Depends | Reads | Status |
|----|------|---------|-------|--------|
| T3.1 | `POST /api/auth/signup` — transactional multi-table create | T2.3 | `FEATURE-A-SPEC.md` §5 | ⬜ |
| T3.2 | `POST /api/auth/login` — timing-safe, non-enumerating | T2.3, T2.4 | `SECURITY.md` | ⬜ |
| T3.3 | `POST /api/auth/logout` — server-side revocation | T2.2 | — | ⬜ |
| T3.4 | `GET /api/auth/session` — hydration endpoint | T2.3 | — | ⬜ |
| T3.5 | OTP issue + verify — 6 digits, hashed, 5 attempts, 10 min | T1.5, T2.5 | `SECURITY.md` G7 | ⬜ |
| T3.6 | `POST /api/auth/change-email` — token to the new address | T3.5 | — | ⬜ |
| T3.7 | Forgot password — works for SSO-only accounts (L070) | T3.5 | `DECISIONS.md` L070 | ⬜ |
| T3.8 | **`DELETE /api/account`** — cascade delete, DPDP requirement | T2.3, T3.5 | `DATABASE.md` §4, L064 | ⬜ |
| T3.9 | **`POST /api/auth/sessions/revoke-all`** — log out all devices | T2.2 | `DATABASE.md` §2.3 | ⬜ |

## P4 — SSO

| ID | Task | Depends | Reads | Status |
|----|------|---------|-------|--------|
| T4.1 | **OAuth `state` + PKCE service** — single-use, 10 min, session-bound | T2.2, T1.9 | `SECURITY-CONTROLS.md` §1 | ⬜ |
| T4.2 | Google OIDC adapter — `openid profile email`, name claim only (L082) | T4.1 | `DECISIONS.md` L082 | ⬜ |
| T4.3 | **Callback + account linking** — auto-link on verified email, invalidate unverified password | T4.2, T1.6 | `DECISIONS.md` L069 | ⬜ |
| T4.4 | LinkedIn adapter — button rendered, wired when Page exists | T4.3 | L074 | ⏸ |
| T4.5 | **`GET`/`DELETE /api/account/connections`** — list linked methods, unlink one. **Must reject removing the last credential** (`DATABASE.md` §3) | T4.3 | `DATABASE.md` §3, L070 | ⬜ |

## P5 — Profile + AI

| ID | Task | Depends | Reads | Status |
|----|------|---------|-------|--------|
| T5.1 | `AIProvider` interface — services never touch an SDK | T2.3 | `BACKEND.md` | ⬜ |
| T5.2 | `GeminiAdapter` — PDF sent natively, no pre-parsing | T5.1 | L061 | ⬜ |
| T5.3 | Prompt templates in DB, versioned | T5.1 | L060 | ⬜ |
| T5.4 | `POST /api/profile/parse-resume` — validate, extract, **persist nothing** | T5.2 | `SECURITY.md` G10 | ⬜ |
| T5.5 | `GET`/`PUT /api/profile` — session-derived ownership, field whitelist | T1.3, T2.3 | `SECURITY.md` | ⬜ |
| T5.6 | Profile completeness rule → `completed_at` | T5.5 | L047 | ⬜ |

## P6 — Subscription (read-only)

| ID | Task | Depends | Reads | Status |
|----|------|---------|-------|--------|
| T6.1 | `GET /api/subscription` — tier, trial days remaining | T1.7, T2.3 | — | ⬜ |
| T6.2 | Trial initialisation at signup (+12 days) | T3.1 | — | ⬜ |

## P7 — Security hardening

| ID | Task | Depends | Reads | Status |
|----|------|---------|-------|--------|
| T7.1 | Security headers middleware — CSP, HSTS, nosniff, Referrer, Permissions | T2.3 | `SECURITY.md` G4 | ⬜ |
| T7.2 | CSRF — double-submit token + Origin/Referer validation | T2.3 | `SECURITY.md` G5 | ⬜ |
| T7.3 | **Fail-closed audit** — every auth-path catch block defaults restrictive | P2, P3, P4 | `SECURITY.md` G2 | ⬜ |
| T7.4 | Cookie config — `Secure`/`__Host-` gated on `NODE_ENV` | T2.2 | `SECURITY-CONTROLS.md` §11 | ⬜ |
| T7.5 | **Trust-proxy handling** — client IP from `X-Forwarded-For` only when `TRUST_PROXY=true`. **The only control that needs code, not config** | T2.4 | `SECURITY-CONTROLS.md` §12.2 | ⬜ |

## P9 — Operations

| ID | Task | Depends | Reads | Status |
|----|------|---------|-------|--------|
| T9.1 | **`GET /api/health`** — 200 without touching the DB. Railway's health check fails without it and the deploy silently never goes live | — | `SECURITY-CONTROLS.md` §12.1 | ⬜ |
| T9.2 | **Nightly `pg_dump` → R2, in-container** (L089). Private networking; no extra service, no egress | T1.1 | `DATABASE.md` §7 | ⬜ |
| T9.3 | Env validation at boot — crash on missing vars, never mid-request | — | `BACKEND.md` §8 | ⬜ |
| T9.4 | Expired-row sweep — `oauth_states`, `verification_tokens`, `auth_attempts` | T1.9 | `DATABASE.md` | ⬜ |

## P8 — Frontend ⏸ BLOCKED ON WIREFRAMES

Listed for dependency completeness. **Do not specify in detail until designs land.**

| ID | Task | Status |
|----|------|--------|
| T8.1 | Signup + login pages | ⏸ |
| T8.2 | SSO buttons (Google active, LinkedIn placeholder) | ⏸ |
| T8.3 | OTP entry screen — distinguish expired vs incorrect | ⏸ |
| T8.4 | Resume upload + **mandatory review** screen | ⏸ |
| T8.5 | Profile builder form | ⏸ |
| T8.6 | Auth state + route guard (UX only) | ⏸ |
| T8.7 | Subscription badge | ⏸ |

---

## Totals

**44 tasks across 9 groups.** 37 specifiable now, 7 blocked on wireframes.

**Added 2026-08-25, first completeness review:** T3.8 (account deletion), T3.9 (revoke all sessions), T4.5 (connected accounts).

**Added 2026-08-25, second review:** T1.9 (`oauth_states` — the table T4.1 needs and that didn't exist), T7.5 (trust-proxy), and all of P9 (health endpoint, backup job, env validation, expiry sweep).

Both rounds found the same failure mode: **a decision recorded in one document that never reached the schema or the task list.** Worth re-running this audit after F2 is designed.

## Highest-risk tasks

These three are load-bearing for the whole system — four later features inherit whatever is built here:

| ID | Why |
|----|-----|
| **T2.3** | Session middleware is the sole place identity is established. Every authorization check in Trackr depends on it. |
| **T4.3** | Account linking. Get the L069 rule wrong and you ship a pre-registration takeover. |
| **T5.1** | `AIProvider` interface — reused by F3 and F5. A leaky abstraction here means provider lock-in everywhere. |

Give these extra review. Consider pairing the PR review with a second pass specifically against `SECURITY.md`.

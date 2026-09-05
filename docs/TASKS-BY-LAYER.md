# TASKS-BY-LAYER.md — Feature A

The same tasks as `TASKS.md`, grouped by **architectural layer** instead of dependency order.

`TASKS.md` remains the source of truth for status and dependencies. This is a different view of it — useful for seeing how much work sits in each layer, and which tasks can run in parallel.

**Task IDs are identical across both files.** Nothing here is new.

---

# LAYER MAP

```
FRONTEND      React components → fetch()          7 tasks   ⏸ blocked
     ↓
API           /app/api/*/route.ts                13 tasks
     ↓
BACKEND       services, middleware, adapters     13 tasks
     ↓
DATABASE      migrations, schema                  9 tasks
                                                 ──────────
CROSS-CUTTING security middleware                 4 tasks
DISPUTED      pending your decision               6 tasks
```

---

# 1 · DATABASE LAYER — 9 tasks

Migrations only. No application code. Every one is reversible.

| ID | Table(s) | Notable |
|----|----------|---------|
| T1.1 | — | Migration tooling + reversible baseline. **Nothing else can start.** |
| T1.2 | `users` | `citext` + `pgcrypto` extensions. `password_hash` **nullable** (SSO) |
| T1.3 | `profiles` | 3 enums + `salary_complete` CHECK constraint |
| T1.4 | `sessions` | Partial index — the highest-frequency query in the system |
| T1.5 | `verification_tokens`, `email_log` | `attempts` counter; `email_log` doubles as the Brevo quota counter |
| T1.6 | `oauth_accounts` | Keyed on OIDC `sub`, never email |
| T1.7 | `subscriptions`, `generation_quota` | Quota separate from billing period — different cycles |
| T1.8 | `auth_attempts`, `security_events` | Neither cascades — both survive account deletion |
| T1.9 | `oauth_states` | Required by T4.1; **found missing in the second audit** |

**Fully parallelisable after T1.1.** All eight remaining tables depend only on `users` (T1.2) and nothing on each other. Two exceptions: T1.9 and T1.6 both need T1.2 first.

**Reads:** `DATABASE.md` · `DATABASE-SECURITY.md`

---

# 2 · BACKEND LAYER — 13 tasks

Services, middleware, adapters. **No HTTP awareness, no SQL** (`BACKEND.md` §1).

## Auth core

| ID | Deliverable | Notes |
|----|-------------|-------|
| T2.1 | Argon2id hash/verify | Pure function. Fully unit-testable, no DB. |
| T2.2 | Session service — issue/resolve/revoke | Token hashed at rest |
| T2.3 | **Session middleware** | ⚠️ Sole identity chokepoint. Must fail closed. |
| T2.4 | Postgres rate limiter | No Redis (L030) |
| T2.5 | Security event logger | Feeds `security_events` |

## OAuth

| ID | Deliverable | Notes |
|----|-------------|-------|
| T4.1 | `state` + PKCE service | Single-use, 10 min, session-bound |
| T4.2 | Google OIDC adapter | `openid profile email`. **Name claim only** (L082) |

## AI

| ID | Deliverable | Notes |
|----|-------------|-------|
| T5.1 | `AIProvider` interface | ⚠️ Reused by F3 and F5. A leaky abstraction here means provider lock-in everywhere. |
| T5.2 | `GeminiAdapter` | PDF sent natively — no pre-parsing (L061) |
| T5.3 | Prompt templates, versioned in DB | Different providers want different phrasing |

## Business rules

| ID | Deliverable | Notes |
|----|-------------|-------|
| T3.5 | OTP issue + verify (service half) | 6 digits, hashed, 5 attempts, 10 min |
| T5.6 | Profile completeness rule | Sets `completed_at` → gates app access (L047) |
| T6.2 | Trial initialisation | signup + 12 days |

**Reads:** `BACKEND.md` · `SECURITY-CONTROLS.md` · `CODECONDUCT.md`

---

# 3 · API LAYER — 13 tasks

Route handlers. Parse, validate, authorize, call one service, shape the response. **No business logic, no SQL.**

| ID | Endpoint | Method | Auth |
|----|----------|--------|------|
| T3.1 | `/api/auth/signup` | POST | — |
| T3.2 | `/api/auth/login` | POST | — |
| T3.3 | `/api/auth/logout` | POST | session |
| T3.4 | `/api/auth/session` | GET | session |
| T3.5 | `/api/auth/verify` | POST | — |
| T3.6 | `/api/auth/change-email` | POST | session |
| T3.7 | `/api/auth/forgot-password` | POST | — |
| T3.8 | `/api/account` | DELETE | session |
| T3.9 | `/api/auth/sessions/revoke-all` | POST | session |
| T4.3 | `/api/oauth/google/{start,callback}` | GET | — |
| T4.5 | `/api/account/connections` | GET, DELETE | session |
| T5.4 | `/api/profile/parse-resume` | POST | session |
| T5.5 | `/api/profile` | GET, PUT | session |
| T6.1 | `/api/subscription` | GET | session |

**Universal rule across every row:** `user_id` comes from the session, never from the body, query, or path. With RLS gone (L023), this is the only thing preventing IDOR.

**Cross-layer tasks:** T3.5, T4.3, T4.5, T5.4 and T5.5 each carry meaningful service logic alongside the route handler. They appear in both this section and §2 where relevant — the layer boundary still applies inside them.

**Reads:** `FEATURE-A-SPEC.md` §5 · `SECURITY-CONTROLS.md` · `DATABASE-SECURITY.md`

---

# 4 · FRONTEND LAYER — 7 tasks ⏸

**Blocked on wireframes for layout only.** Everything below is already determined by the API contracts and does not change when designs arrive.

| ID | Screen | Calls | Must handle |
|----|--------|-------|-------------|
| T8.1 | Signup + login | `POST /auth/signup`, `POST /auth/login` | Loading · **generic error matching the non-enumerating API** · validation · redirect to OTP |
| T8.2 | SSO buttons | `GET /oauth/google/start` | Google active · **LinkedIn rendered but disabled** (L074) · provider error return |
| T8.3 | OTP entry | `POST /auth/verify`, resend | **"Expired — resend" vs "Incorrect — N left" must differ** · resend cooldown · lockout after 5 |
| T8.4 | Resume upload + **review** | `POST /profile/parse-resume`, `PUT /profile` | Upload progress · every extracted field **visibly editable** · parse failure · non-PDF rejection |
| T8.5 | Profile builder | `GET`/`PUT /profile` | Skills tag input · salary (amount + currency + period) · **dirty-state warning** · per-field validation |
| T8.6 | Auth state + route guard | `GET /auth/session` | Unauthenticated redirect · **incomplete profile → profile builder** (L047) · session expiry mid-use |
| T8.7 | Connected accounts | `GET`/`DELETE /account/connections` | List methods · **block removing the last credential** · confirmation |

## What wireframes will and won't change

**Won't change:** which endpoints each screen calls · which states must be handled · what data flows in and out · the security rules (guards are UX only; the server enforces independently).

**Will change:** layout, component breakdown, copy, visual hierarchy, how many steps a flow is split across.

## Two screens where design carries real weight

**T8.4 — the review screen.** L049 says parse output is never saved blind. This screen *is* that control. If extracted fields don't look obviously editable and obviously in need of checking, users click through and the safeguard evaporates.

**T8.3 — OTP errors.** Distinguishing expired from incorrect is a stated requirement (L071). A single generic error is a worse experience and leaks nothing useful anyway.

**Reads:** `FRONTEND.md` · `SECURITY-CONTROLS.md` §5

---

# 5 · CROSS-CUTTING — 4 tasks

Middleware and configuration. Not owned by any single layer.

| ID | Deliverable | Environment-dependent? |
|----|-------------|------------------------|
| T7.1 | Security headers — CSP, HSTS, nosniff, Referrer, Permissions | **Yes** — CSP and HSTS via `NODE_ENV` |
| T7.2 | CSRF — double-submit + Origin/Referer | Origin value only |
| T7.3 | Fail-closed audit across every auth path | **No — never** |
| T7.4 | Cookie config — `Secure` / `__Host-` | **Yes** — via `NODE_ENV` |

T7.3 is an audit, not a build. It runs **after** P2, P3 and P4 are merged, checking that every catch block in an auth path defaults to denial.

**Reads:** `SECURITY-CONTROLS.md` §4, §5, §2, §11

---

# 6 · DISPUTED — 6 tasks, pending your decision

I added these without being asked, and flagged four as premature when you challenged it. **Listed here for completeness, not endorsed.** My assessment:

| ID | Task | My view |
|----|------|---------|
| T7.5 | Trust-proxy handling | **Wrong shape** — it's an acceptance criterion inside T2.4, not a separate task |
| T9.1 | `/api/health` | Premature — exists for a platform health check you can't reach |
| T9.2 | Backup job | Premature — no production, no data, no bucket. L026 already said "deferred" |
| T9.3 | Env validation at boot | Marginal — genuinely useful, but part of the scaffold |
| T9.4 | Expiry sweep | Premature — zero rows exist |

**Proposal, unchanged:** fold T7.5 into T2.4, drop P9 entirely, recreate it as a "pre-deploy" group when deployment becomes real. That returns the count to **39 tasks, all startable**.

Nothing has been changed in `TASKS.md` pending your call.

---

# 7 · WORK AVAILABLE BY LAYER

| Layer | Total | Startable now |
|---|---|---|
| Database | 9 | **9** |
| Backend | 13 | **13** |
| API | 13 | **13** |
| Cross-cutting | 4 | **4** |
| Frontend | 7 | 0 — blocked |
| Disputed | 6 | — |
| **Total** | **52** | **39** |

**39 tasks are startable today.** The frontend block affects 13% of the work.

---

# 8 · PARALLELISATION

Layers are sequenced by dependency, but within a layer there's room:

**After T1.1 alone**, all eight remaining migrations can be written in one sitting — they don't depend on each other.

**T2.1 (Argon2id) has no dependencies beyond T1.2** and is pure logic. Good second task: fully unit-testable, no DB, no HTTP.

**T5.1–T5.3 (the AI layer) are independent of all auth work.** If you want variety between auth tasks, this is the branch to take.

**T7.1, T7.2 and T7.4 only need T2.3.** They can land early rather than being saved for the end — and landing them early means every subsequent task inherits the headers and CSRF protection automatically.

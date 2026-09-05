# FEATURE A (F1) — User Accounts
## Technical Specification v1.0

> ## ⚠️ PARTIALLY SUPERSEDED — read this first
>
> Written **before** SSO (L068) and OTP (L071) were added. Sections are no longer uniformly current:
>
> | Section | Status |
> |---|---|
> | §1 Scope | ⚠️ Stale — SSO is now IN, password reset is now IN |
> | §2 Decisions carried in | ⚠️ Incomplete — see `DECISIONS.md` |
> | §3 Domain model | ✅ Valid, plus `OAuthAccount` |
> | **§4 Data architecture** | ❌ **SUPERSEDED by `DATABASE.md`** — use that |
> | §5 API surface | ⚠️ Incomplete — no OAuth or OTP routes |
> | §6 Security architecture | ⚠️ Valid but incomplete — `SECURITY.md` found 10 more gaps, **all now resolved in `SECURITY-CONTROLS.md`** |
> | **§7 Task decomposition** | ❌ **SUPERSEDED by `TASKS.md`** — 35 tasks, not 26 |
> | §8 Dependencies | ✅ Valid |
> | §9 Success criteria | ⚠️ Incomplete — no SSO or OTP criteria |
> | §10 Open items | ✅ Valid, partly resolved |
>
> **Live documents:** `DATABASE.md` (schema) · `TASKS.md` (work) · `SECURITY.md` (threats) · `DECISIONS.md` (decisions).
>
> Kept for the reasoning in §1–§3 and §8, which remains sound.

**Status:** Backend settled · Frontend provisional (blocked on wireframes)
**Date:** 2026-08-24
**Supersedes:** `archive/trackr-feature-analysis-pass1.md` Part 3

This is a **canonical artifact** — future tasks cite it rather than re-deriving. Every decision traces to a ledger ID in `DECISIONS.md`.

---

# 1 · SCOPE

**In:** email/password identity · sessions · email verification · structured profile · resume-driven profile auto-fill · subscription tier display (read-only).

**Out:** social login (rejected, MVP) · password reset (deferred — see §10) · MFA · team/org accounts · any subscription *write* path (belongs to F6).

**Business intent:** the profile is not account metadata — it is the **permanent left-hand input to every AI generation call**. An empty profile produces unusable cover letters, which is the fastest way to lose a user. That is why L047 makes it mandatory.

---

# 2 · DECISIONS CARRIED IN

| Ledger | Decision |
|---|---|
| L017 | Modular monolith, single deployable |
| L018 | All logic behind JSON APIs; web + future mobile are peer clients |
| L021 | Next.js 16 on Railway |
| L022, L025 | Railway Postgres; free lift-and-shift is a standing requirement |
| L023, L039 | Supabase rejected → auth is self-built |
| L040 | Email verification gates **first AI generation**, not signup |
| L041 | Timezone captured at signup |
| L044 | httpOnly cookie + server-side session table (not JWT) |
| L045 | Skills as `text[]`, lowercase-normalized |
| L046 | `experience_level` as enum |
| L047 | Profile mandatory before app access |
| L049 | Resume parse output never saved blind — review is mandatory |
| L050 | Two email fields: login identity vs contact |
| L051 | Email changeable, with re-verification |
| L052 | Password min 12 chars, no complexity rules |
| L060 | Provider-agnostic `AIProvider` interface |
| L061 | PDF sent **directly to Gemini** — no `pdf-parse`, native vision handles scans |
| L064 | Data minimization baseline |

---

# 3 · DOMAIN MODEL

```
User (identity)
 ├─1:1─ Profile          (product input — feeds all generation)
 ├─1:1─ Subscription     (tier; read-only here, written by F6)
 ├─1:1─ GenerationQuota  (monthly counter; separate from billing period)
 ├─1:*─ Session
 └─1:*─ VerificationToken
```

**Why `GenerationQuota` is separate from `Subscription`:** the quota period (calendar month) and the billing period (subscription anniversary) are different cycles. Collapsing them into one row means a user who subscribes on the 20th gets a quota reset on the 20th — wrong, and painful to unpick later.

---

# 4 · DATA ARCHITECTURE

```sql
CREATE EXTENSION IF NOT EXISTS citext;
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- 4.1 IDENTITY -------------------------------------------------------------
CREATE TABLE users (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email             CITEXT NOT NULL UNIQUE,      -- citext: blocks case-variant duplicates
  password_hash     TEXT   NOT NULL,             -- Argon2id
  email_verified_at TIMESTAMPTZ,                 -- NULL = unverified
  timezone          TEXT   NOT NULL,             -- IANA, e.g. 'Asia/Kolkata'  (L041)
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 4.2 PROFILE --------------------------------------------------------------
CREATE TYPE experience_level AS ENUM ('junior','mid','senior','lead');
CREATE TYPE salary_period    AS ENUM ('monthly','annual');
CREATE TYPE profile_source   AS ENUM ('manual','resume_upload');

CREATE TABLE profiles (
  user_id             UUID PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  full_name           TEXT NOT NULL,
  contact_email       CITEXT,                    -- L050: ≠ login email; Reply-To for recruiters
  skills              TEXT[] NOT NULL DEFAULT '{}',   -- L045
  experience_level    experience_level NOT NULL,      -- L046
  target_role         TEXT NOT NULL,
  salary_amount       NUMERIC(12,2),
  salary_currency     CHAR(3),                   -- ISO 4217
  salary_period       salary_period,
  location_preference TEXT,
  source              profile_source NOT NULL DEFAULT 'manual',
  completed_at        TIMESTAMPTZ,               -- NULL = incomplete → app access blocked (L047)
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT now(),

  -- salary is all-or-nothing: an amount without a currency is a data bug
  CONSTRAINT salary_complete CHECK (
    (salary_amount IS NULL AND salary_currency IS NULL AND salary_period IS NULL)
    OR
    (salary_amount IS NOT NULL AND salary_currency IS NOT NULL AND salary_period IS NOT NULL)
  )
);

-- 4.3 SESSIONS -------------------------------------------------------------
CREATE TABLE sessions (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token_hash TEXT NOT NULL UNIQUE,   -- SHA-256 of the cookie value; raw token NEVER stored
  expires_at TIMESTAMPTZ NOT NULL,
  revoked_at TIMESTAMPTZ,
  user_agent TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_sessions_lookup ON sessions(token_hash) WHERE revoked_at IS NULL;
CREATE INDEX idx_sessions_user   ON sessions(user_id);

-- 4.4 VERIFICATION TOKENS --------------------------------------------------
CREATE TYPE token_purpose AS ENUM ('verify_email','change_email');

CREATE TABLE verification_tokens (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token_hash TEXT NOT NULL UNIQUE,   -- hashed, same reasoning as sessions
  purpose    token_purpose NOT NULL,
  new_email  CITEXT,                 -- only for 'change_email' (L051)
  expires_at TIMESTAMPTZ NOT NULL,
  used_at    TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 4.5 SUBSCRIPTION (stub — breaks the F3↔F6 cycle) -------------------------
CREATE TYPE subscription_tier   AS ENUM ('free','pro');
CREATE TYPE subscription_status AS ENUM ('trialing','active','past_due','cancelled');

CREATE TABLE subscriptions (
  user_id            UUID PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  tier               subscription_tier   NOT NULL DEFAULT 'free',
  status             subscription_status NOT NULL DEFAULT 'trialing',
  trial_ends_at      TIMESTAMPTZ,        -- signup + 12 days
  current_period_end TIMESTAMPTZ,
  provider           TEXT,               -- 'razorpay' | 'stripe' — NULL until F6
  created_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at         TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 4.6 GENERATION QUOTA -----------------------------------------------------
CREATE TABLE generation_quota (
  user_id      UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  period_start DATE NOT NULL,           -- first of calendar month
  used         INT  NOT NULL DEFAULT 0,
  PRIMARY KEY (user_id, period_start)
);

-- 4.7 AUTH RATE LIMITING (Postgres, not Redis — L030) ----------------------
CREATE TABLE auth_attempts (
  id         BIGSERIAL PRIMARY KEY,
  identifier TEXT NOT NULL,             -- IP or email
  succeeded  BOOLEAN NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_auth_attempts ON auth_attempts(identifier, created_at DESC);
```

**Deletion graph:** every table cascades from `users`. Deleting a user removes profile, sessions, tokens, subscription, and quota in one transaction — satisfying L064's DPDP requirement. `auth_attempts` deliberately does **not** reference `users` (it must log attempts against non-existent accounts).

**Index rationale (§12 discipline):**

| Index | Serves | Justification |
|---|---|---|
| `idx_sessions_lookup` | Session resolution on **every authenticated request** | Highest-frequency query in the system. Partial index (`revoked_at IS NULL`) keeps it small. |
| `idx_sessions_user` | "Log out all devices", cascade delete | Low frequency, but unindexed FK cascade on a growing table is a latent problem |
| `idx_auth_attempts` | Rate-limit window count | Read on every login attempt |

No index on `users.email` — the `UNIQUE` constraint already creates one.

---

# 5 · API SURFACE

All routes under `/app/api/*`. All return JSON. **No business logic in server components** (L018).

| Method | Route | Auth | Notes |
|---|---|---|---|
| POST | `/api/auth/signup` | — | Creates user + profile shell + subscription + quota in **one transaction**. Sets session cookie. Captures timezone from body. |
| POST | `/api/auth/login` | — | Timing-safe. **Identical error** for unknown-email and wrong-password. |
| POST | `/api/auth/logout` | session | Sets `revoked_at` server-side, then clears cookie |
| GET | `/api/auth/session` | session | Current user + profile-completeness + tier. Single hydration call. |
| POST | `/api/auth/verify-email` | — | Consumes token, sets `email_verified_at` |
| POST | `/api/auth/resend-verification` | session | Rate-limited |
| POST | `/api/auth/change-email` | session | Issues `change_email` token to the **new** address; swap only on confirmation (L051) |
| POST | `/api/profile/parse-resume` | session | Upload PDF → `AIProvider.extractProfile()` → **returns structured JSON, saves nothing** (L049) |
| GET | `/api/profile` | session | Current user only |
| PUT | `/api/profile` | session | Whitelisted fields only. Sets `completed_at` when minimum fields present. |
| GET | `/api/subscription` | session | **Read-only.** No write path exists in F1. |

**Universal rule:** `user_id` is derived from the session, **never** from the request body, query string, or URL path. This is the single control preventing IDOR — and with Supabase's RLS gone (L023), it is the *only* one.

---

# 6 · SECURITY ARCHITECTURE

| Threat | Control | Location | Verification |
|---|---|---|---|
| **IDOR / BOLA** — reading another user's profile | `user_id` from session context only | Session middleware + every repository call | **Security test required** |
| **User enumeration** | Identical response and timing for unknown-email vs wrong-password | `/api/auth/login` | **Security test required** |
| **Brute force** | Postgres-backed rate limit on IP + email | `/api/auth/login`, `/api/auth/signup` | **Security test required** |
| **Session theft via DB leak** | Store SHA-256 of token, never the token | `sessions.token_hash` | Unit test |
| **Session not revocable** | Server-side `revoked_at`, checked every request | Middleware | Integration test |
| **Mass assignment** | Explicit field whitelist on `PUT /api/profile` | Route handler | **Security test required** |
| **Privilege escalation** | `tier` has no client-writable path in F1 | Absence of endpoint | Integration test |
| **XSS** | React auto-escaping + no `dangerouslySetInnerHTML` on user text | All components | Component test |
| **Credential leakage** | Argon2id; `password_hash` never in any response or log | Repository serializer | Unit test |
| **Malicious upload** | MIME + magic-byte check, size cap, PDF only, never persisted to disk | `/api/profile/parse-resume` | **Security test required** |
| **Token replay** | Single-use (`used_at`), short expiry | `verification_tokens` | Integration test |

**Session parameters:** httpOnly · Secure · SameSite=Lax · 30-day expiry · rotate on login.

**L064 applied here:** uploaded resume bytes are held in memory, sent to the AI provider, and discarded — never written to disk or R2. Only the structured profile persists.

---

# 7 · TASK DECOMPOSITION

Revised for Next.js 16 + the L061 pipeline. Supersedes the earlier 5/17 breakdown.

### P1 — Data foundation
| Task | Deliverable | Tests |
|---|---|---|
| T1.1 | Migration tooling + reversible baseline | Up/down |
| T1.2 | `users` + `citext`/`pgcrypto` extensions | Migration |
| T1.3 | `profiles` + enums + salary CHECK | Migration |
| T1.4 | `sessions`, `verification_tokens` + indexes | Migration |
| T1.5 | `subscriptions`, `generation_quota`, `auth_attempts` | Migration |

### P2 — Auth core
| Task | Deliverable | Tests |
|---|---|---|
| T2.1 | Argon2id hash/verify module | **Unit** — no plaintext in errors or logs |
| T2.2 | Session service: issue / resolve / revoke, token hashed at rest | Unit + integration |
| T2.3 | Session middleware — the **only** place identity is established | Integration |
| T2.4 | Postgres rate limiter | **Security test** |

### P3 — Auth API
| Task | Deliverable | Tests |
|---|---|---|
| T3.1 | `POST /signup` — transactional multi-table create | Integration |
| T3.2 | `POST /login` — timing-safe, non-enumerating | **Security test** |
| T3.3 | `POST /logout` — server-side revocation | Integration |
| T3.4 | `GET /session` — hydration endpoint | Integration |
| T3.5 | Email verification issue + consume | Integration |
| T3.6 | Change-email flow with re-verification | Integration |

### P4 — Profile + AI
| Task | Deliverable | Tests |
|---|---|---|
| T4.1 | `AIProvider` interface + `GeminiAdapter` (L060) | Unit, provider mocked |
| T4.2 | Prompt templates in DB, versioned | Unit |
| T4.3 | `POST /parse-resume` — validate → provider → JSON, **no persistence** | **Security test** (upload validation) |
| T4.4 | `GET/PUT /profile` — session-derived ownership, field whitelist | **Security test** (IDOR + mass assignment) |
| T4.5 | Completeness rule → sets `completed_at` | Unit |

### P5 — Subscription read model
| Task | Deliverable | Tests |
|---|---|---|
| T5.1 | Read-only `GET /subscription` incl. trial days remaining | Integration |
| T5.2 | Trial initialization at signup (+12 days) | Unit |

### P6 — Frontend ⚠️ PROVISIONAL
**Blocked on wireframes.** Listed for dependency-graph completeness only; do not spec in detail yet.

T6.1 signup/login pages · T6.2 auth state + route guard (UX only — server enforces independently) · T6.3 resume upload + review screen · T6.4 profile form · T6.5 verification prompt · T6.6 tier badge

**Totals: 6 parent tasks · 26 subtasks** (20 backend specifiable now, 6 frontend awaiting design).

---

# 8 · DEPENDENCIES

**F1 depends on:** nothing. It is the foundation.

**Depends on F1:**

| Feature | Needs from F1 |
|---|---|
| F2 Application Tracker | `user_id` ownership, session middleware |
| F3 AI Generation | Profile (prompt input) · `AIProvider` interface · `generation_quota` · `subscriptions.tier` · `email_verified_at` gate (L040) |
| F4 Follow-up | `users.timezone` (reminder scheduling) · `profiles.contact_email` (Reply-To) |
| F5 Post-Call Log | `AIProvider` interface |
| F6 Payments | Writes to `subscriptions`, which F1 creates |

**The F3↔F6 cycle, broken:** F3 needs a tier; F6 is built last. F1 ships `subscriptions` with a hardcoded enum, so F3 reads a column rather than a payment provider. F6 later attaches real billing to the same row.

**Three F1 artifacts are load-bearing across the whole system** — get them right here and four later features inherit correctness:
1. Session middleware — the sole identity chokepoint
2. `AIProvider` interface — reused by F3 and F5
3. `users.timezone` — F4's scheduling is wrong without it

---

# 9 · SUCCESS CRITERIA

1. Signup → profile via resume upload → review → save → app access, end to end
2. Signup → profile via manual entry → app access, end to end
3. Log out, log back in — data persists, old session token rejected
4. A scanned/image-only PDF parses correctly (L061)
5. User A cannot read or write User B's profile via any endpoint
6. Login reveals nothing about whether an email exists
7. Rate limiter blocks repeated failed logins
8. `tier` cannot be modified through any F1 endpoint
9. Deleting a user removes all dependent rows in one transaction
10. Timezone is captured and stored as a valid IANA identifier

---

# 10 · OPEN / DEFERRED

| | Item | Status |
|---|---|---|
| ⚠️ | **Wireframes** — P6 stays provisional | Expected within days |
| ⚠️ | **L066** — verify real Gemini quota in AI Studio console | Blocks parse-resume throughput sizing |
| ⚠️ | **L029** — confirm Brevo (verification emails depend on it) | Blocking |
| ⏸ | **Password reset** — deferred from MVP, but users *will* need it | Reuses `verification_tokens`; add a third `token_purpose` |
| ⏸ | **Account deletion endpoint** — the cascade is designed, the UI/endpoint is not | DPDP-relevant; recommend before public launch |
| ❓ | Session absolute lifetime vs sliding renewal | Defaulting to 30-day fixed |
| ❓ | Should `contact_email` require verification if used as Reply-To? | Recommend yes before F4 sends anything |

---

*Cite this document by section rather than re-deriving. If implementation contradicts it, stop and escalate (§31) — do not silently redesign.*

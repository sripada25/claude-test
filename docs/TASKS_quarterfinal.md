# TASKS_quarterfinal.md — Trackr Backend Tasks

Complete backend task list: **F0 Marketing · F1 User Accounts · F2 Application Tracker · F3 AI Generation · F4 Follow-up System**, plus **P9 Operations**.

Frontend component tasks are in `TASKS-FRONTEND_quarterfinal.md`. This file is database, services, API routes, scheduling, and security.

Supersedes `TASKS.md` and `TASKS-2026-08-26-v2.md` for backend scope. Those files remain as history.

---

# CONVENTIONS

**Environment marker on every task:**

| | Meaning |
|---|---|
| ✅ **Local-complete** | Builds and verifies fully on your machine |
| ⚙️ **Local + config** | Works locally; one env var differs in production |
| 🌐 **Deploy-only** | Cannot be verified locally |
| ⏸ **Blocked** | External dependency missing |

**Dependencies are on MERGED tasks**, not merely approved ones (L015's completion-state rule).

**Every task touching `applications` carries the soft-delete filter as an explicit acceptance criterion** (L123) — never a convention someone remembers.

---

# BUILD ORDER

```
F1 P1 Data foundation
      ↓
F1 P2 Auth core ──────────┐
      ↓                   │
F1 P3 Auth API      F1 P4 SSO
      ↓                   │
      └─────────┬─────────┘
                ↓
       F1 P5 Profile + AI
                ↓
       F1 P6 Subscription
                ↓
       F1 P7 Cross-cutting security
                ↓
       ═══════════════════
       F2 Application Tracker
                ↓
       F3 AI Generation (needs F1's T5.1 + F2's applications table)
                ↓
       F4 Follow-up System
                ↓
       F0 Marketing (independent — any time after repo setup)
       F6 Payments (dependent — subscriptions stub in F1 unblocks it; checkout flow now substantially designed)
       P9 Operations (independent — spec now, execute near deploy)
```

---
---

# F1 · USER ACCOUNTS

## P1 — Data foundation

| ID | Task | Depends | Env | Notes |
|---|---|---|---|---|
| T1.1 | ✅ DONE — Migration tooling + reversible baseline | — | ✅ | Merged via PR #2 (2026-09-05). Hand-rolled runner, no third-party migration library |
| T1.2 | ✅ DONE — `users` table · `citext` + `pgcrypto` extensions | T1.1 | ✅ | Merged via PR #4 (2026-09-05). `password_hash` nullable (SSO) |
| T1.3 | ✅ DONE — `profiles` table · enums · `salary_complete` CHECK | T1.2 | ✅ | Merged via PR #6 (2026-09-05). `years_experience`/`months_experience` (L107), not an enum |
| T1.4 | `sessions` table + partial index | T1.2 | ✅ | 24h absolute expiry (L118) |
| T1.5 | `verification_tokens` + `email_log` | T1.2 | ✅ | `attempts` counter; `email_log` doubles as provider quota counter |
| T1.6 | `oauth_accounts` table | T1.2 | ✅ | Keyed on OIDC `sub`, never email |
| T1.9 | `oauth_states` table | T1.2 | ✅ | Required by T4.1 — state/PKCE storage (L075) |
| T1.7 | `subscriptions` + `generation_quota` | T1.2 | ✅ | `trial_generations_limit` default 40 (L111) |
| T1.8 | `auth_attempts` + `security_events` | T1.1 | ✅ | Neither cascades from `users` |

**Reads:** `DATABASE_quarterfinal.md` §2

## P2 — Auth core

| ID | Task | Depends | Env | Notes |
|---|---|---|---|---|
| T2.1 | Argon2id hash/verify module | T1.2 | ✅ | Pure function, fully unit-testable |
| T2.2 | Session service — issue/resolve/revoke | T1.4 | ✅ | Token hashed at rest; rotate on login |
| T2.3 | **Session middleware** — sole identity chokepoint | T2.2 | ✅ | ⚠️ **Fails closed** (L076) — exception ⇒ deny, never pass through |
| T2.4 | Postgres rate limiter | T1.8 | ✅ | ⚠️ **Client IP via T7.5's `getClientIp()`**, not `req.socket` directly |
| T2.5 | Security event logger | T1.8 | ✅ | Feeds `security_events` |
| **T7.5** | **Trust-proxy client IP resolution** | T2.4 | 🌐 | Full spec: `P9-IMPLEMENTATION.md`. `TRUST_PROXY` env-gated. **Post-deploy spoof test required** — cannot verify locally |

⚠️ **T7.5 is listed here, in P2, not in a separate late group** — it's a dependency of T2.4, and every task that logs a client IP depends on it existing first.

**Reads:** `SECURITY_quarterfinal.md` §7 (fail closed), §17.2 (trust proxy)

## P3 — Auth API

| ID | Task | Depends | Env | Notes |
|---|---|---|---|---|
| T3.1 | `POST /api/auth/signup` | T2.3 | ✅ | Transactional: `users`+`profiles`+`subscriptions`+`generation_quota` |
| T3.2 | `POST /api/auth/login` | T2.3, T2.4 | ✅ | Timing-safe, identical response for unknown-email/wrong-password |
| T3.3 | `POST /api/auth/logout` | T2.2 | ✅ | Server-side revocation |
| T3.4 | `GET /api/auth/session` | T2.3 | ✅ | Hydration endpoint |
| T3.5 | OTP issue + verify | T1.5, T2.5 | ⚙️ | 6 digits, hashed, 5 attempts, 10 min. Mailpit → provider at deploy |
| T3.6 | `POST /api/auth/change-email` | T3.5 | ⚙️ | Token to the new address |
| T3.7 | Forgot password — OTP, works for SSO-only accounts | T3.5 | ⚙️ | **Never a temporary password by email** (L099) |
| T3.8 | `DELETE /api/account` | T2.3, T3.5 | ✅ | Cascade delete (DPDP, L064) |
| T3.9 | `POST /api/auth/sessions/revoke-all` | T2.2 | ✅ | Log out all devices |

**Reads:** `SECURITY_quarterfinal.md` §8 (enumeration), §9 (OTP)

## P4 — SSO

| ID | Task | Depends | Env | Notes |
|---|---|---|---|---|
| T4.1 | OAuth `state` + PKCE service | T2.2, T1.9 | ✅ | Single-use, 10 min, session-bound (L075) |
| T4.2 | Google OIDC adapter | T4.1 | ⚙️ | `openid profile email` — **name claim only** (L082) |
| T4.3 | **Callback + account linking** | T4.2, T1.6 | ⚙️ | ⚠️ Auto-link on verified email, invalidate unverified password (L069) — closes pre-registration takeover |
| T4.4 | LinkedIn adapter | T4.3 | ⏸ | Blocked on company Page (L074) |
| T4.5 | `GET`/`DELETE /api/account/connections` | T4.3 | ✅ | ⚠️ Reject removing the last credential — a user must always have a password or a linked OAuth account |

**Reads:** `SECURITY_quarterfinal.md` §2, §3

## P5 — Profile + AI

| ID | Task | Depends | Env | Notes |
|---|---|---|---|---|
| T5.1 | `AIProvider` interface | T2.3 | ✅ | ⭐ Reused by F3, F4 (drafts), F5. Get this right once |
| T5.2 | `GeminiAdapter` | T5.1 | ⚙️ | PDF sent natively (L061). ⚠️ **No tools, no function calling** (L122) |
| T5.3 | Prompt templates, versioned in DB | T5.1 | ✅ | Different providers want different phrasing |
| T5.4 | `POST /api/profile/parse-resume` | T5.2 | ⚙️ | Validate → extract → **persist nothing** (L049) |
| T5.5 | `GET`/`PUT /api/profile` | T1.3, T2.3 | ✅ | Session-derived ownership, field whitelist |
| T5.6 | Profile completeness rule → `completed_at` | T5.5 | ✅ | Gates generation (L047) |

**Reads:** `AI-RULES.md` §2 (all AI ops), §3 (résumé extraction)

## P6 — Subscription (read-only in F1)

| ID | Task | Depends | Env | Notes |
|---|---|---|---|---|
| T6.1 | `GET /api/subscription` | T1.7, T2.3 | ✅ | Tier, trial days remaining, trial generation count |
| T6.2 | Trial initialisation at signup | T3.1 | ✅ | +12 days, 40-generation cap (L111) |

## P7 — Cross-cutting security

| ID | Task | Depends | Env | Notes |
|---|---|---|---|---|
| T7.1 | Security headers middleware | T2.3 | ⚙️ | CSP `unsafe-eval` local only; HSTS **prod only, never localhost** |
| T7.2 | CSRF — double-submit + Origin/Referer | T2.3 | ⚙️ | Allowed origin from `NEXT_PUBLIC_APP_URL` |
| T7.3 | **Fail-closed audit** | P2, P3, P4 | ✅ | Not a build — an audit that every catch block defaults to denial |
| T7.4 | Cookie config — `Secure`/`__Host-` gated on `NODE_ENV` | T2.2 | ⚙️ | Never `SameSite=Strict` (breaks OAuth) |

**Reads:** `SECURITY_quarterfinal.md` §5, §6, §7, §15

---
---

# F2 · APPLICATION TRACKER

## F2-DB — Database

| ID | Task | Depends | Env | Notes |
|---|---|---|---|---|
| F2-1.1 | `applications` table | T1.2 | ✅ | Only `company`/`role` required (designer's note). `deleted_at` for soft delete (L113) |
| F2-1.2 | `source` enum on `applications` | F2-1.1 | ✅ | (L110) |
| F2-1.3 | `application_events` — timeline | F2-1.1 | ✅ | Append-only, never updated |
| F2-1.4 | `documents.jd_snapshot` column | F2-1.1 | ✅ | NULL = same as current JD (L090) |
| F2-1.5 | `idx_applications_board` composite index | F2-1.1 | ✅ | `(user_id, status, last_activity_at DESC) WHERE deleted_at IS NULL` |

## F2-API — Endpoints

| ID | Task | Depends | Env | Soft-delete criterion |
|---|---|---|---|---|
| F2-2.1 | `POST /api/applications` | F2-1.1, T2.3 | ✅ | — |
| F2-2.2 | `GET /api/applications` (search/filter/sort) | F2-2.1 | ✅ | ⚠️ **Must filter `deleted_at IS NULL`** — verified by test |
| F2-2.3 | `GET /api/applications/:id` | F2-2.1 | ✅ | ⚠️ **Must filter `deleted_at IS NULL`** · ownership from session, never the URL |
| F2-2.4 | `PATCH /api/applications/:id` | F2-2.1 | ✅ | ⚠️ Filter · writes a timeline event (2s debounce) · **same service function used by drag** |
| F2-2.5 | `DELETE /api/applications/:id` (soft) | F2-2.1 | ✅ | Only when status is Rejected. Sets `deleted_at` |
| F2-2.6 | `DELETE /api/trash/empty` (hard) | F2-2.5 | ✅ | Immediate hard delete, cascades normally (L113) |
| F2-2.7 | Timeline event service | F2-1.3 | ✅ | Called by every state change |
| F2-2.8 | JD copy-on-write on edit | F2-1.4 | ✅ | Copies old JD into dependent documents |
| F2-2.9 | URL scheme validation | F2-1.2 | ✅ | `http`/`https` only. Reject `javascript:`, `data:`, `file:` (L110) |

⚠️ **F2-2.2 and F2-2.3 are the two highest-priority soft-delete tests** — a leak here surfaces a withdrawn application to its own user, which reads as a bug but is an access-control failure (L123).

**Reads:** `DATABASE_quarterfinal.md` §3, `SECURITY_quarterfinal.md` §14

---
---

# F4 · FOLLOW-UP SYSTEM

**Two reminder rules** (L119) — R1 application follow-up, R2 post-interview. Full spec: `F4-TASKS.md`.

## F4-DB

| ID | Task | Depends | Env |
|---|---|---|---|
| F4-1.1 | `reminders` table | T1.2, F2-1.1 | ✅ |
| F4-1.2 | `applications.follow_up_snoozed_until` column | F2-1.1 | ✅ |
| F4-1.3 | `idx_reminders_queue` index | F4-1.1 | ✅ |

⚠️ **F4-1.2 lives on `applications`, not `reminders`** — the board's derived tag must remain computable from F2 tables alone (L120).

## F4-Scheduler

| ID | Task | Depends | Env | Notes |
|---|---|---|---|---|
| F4-2.1 | Reminder scheduler — both rules, hourly | F4-1.1 | ⚙️ | ⚠️ `due_at` computed in the user's timezone (L041). `ON CONFLICT DO NOTHING` for idempotency |
| F4-2.2 | Notification send | F4-2.1 | ⚙️ | Notifies the *user*, not a recruiter. Respects the Settings toggle. Mailpit → provider |

⚠️ **Both filter `deleted_at IS NULL`** on the joined application — a deleted application must never generate a reminder.

## F4-API

| ID | Endpoint | Depends | Env | Notes |
|---|---|---|---|---|
| F4-2.3 | `GET /api/reminders` | F4-1.1, T2.3 | ✅ | Due now / Upcoming. Filter `deleted_at IS NULL` |
| F4-2.4 | `POST /api/reminders/:id/draft` | T5.1 | ✅ | `AIProvider.draftFollowUp()` — **does not consume quota** (L055) |
| F4-2.5 | `PATCH /api/reminders/:id` (snooze/dismiss) | F4-1.1 | ✅ | Snooze also writes `applications.follow_up_snoozed_until` |
| F4-2.6 | `POST /api/reminders/:id/sent` | F4-1.1 | ✅ | User-confirmed. Writes `sent_at` **and** an `application_events` row — closes the loop the derived tag checks |

## 🔴 Blocking

| | Question | Blocks |
|---|---|---|
## 🔵 Blocked — decision confirmed (L038), design pending

| | Task | Status |
|---|---|---|
| — | `POST /api/reminders/:id/send` — automatic Pro send | 🔵 needs design: confirmation state |
| — | Sent/failure state on the card and timeline | 🔵 needs design |
| — | `contact_email` verification before Reply-To use | 🔴 open — genuinely blocking, not just undesigned |

**L038 itself is settled** — both tiers, per your explicit confirmation. What remains is designing the Pro send flow, which the confirmed decision now requires rather than makes optional.

## 🔴 Still genuinely open

| | Question |
|---|---|
| — | R2 window: 24h or 48h? (PRD says "24–48 hours") |
| — | Does R2 fire if `interview_at` was never set? |

**Reads:** `F4-TASKS.md` in full, `DECISIONS_quarterfinal.md` L119–L121

---
---

# F0 · MARKETING & SUPPORT

Independent of F1–F4. Same Next.js app, route groups (L030 — no second service).

| ID | Task | Depends | Env |
|---|---|---|---|
| F0-1.1 | Route groups + layouts — `(marketing)` / `(app)` | — | ✅ |
| F0-1.2 | Marketing nav | F0-1.1 | ✅ |
| F0-1.3 | Hero section | F0-1.2 | ✅ |
| F0-1.4 | Body / feature sections | F0-1.3 | ✅ |
| F0-1.5 | Pricing section | F0-1.3 | ⚙️ | Dummy CTA until F6 exists |
| F0-1.6 | Announcement banner | F0-1.2 | ✅ |
| F0-1.7 | About page | F0-1.1 | ✅ |
| F0-1.8 | **Terms + Privacy pages** | F0-1.1 | ✅ | ⚠️ Privacy must disclose AI processing (`PRIVACY.md` §3) |
| F0-1.9 | Support contact form | F0-1.1 | ✅ | |
| F0-1.10 | Support email endpoint | F0-1.9, T2.4 | ⚙️ | Rate-limited, honeypot not CAPTCHA |
| F0-1.11 | SEO metadata + sitemap | F0-1.1 | ✅ | |

⚠️ **F0-1.5's pricing copy and F0-1.3/1.4's marketing claims must match `PRIVACY.md` §3's disclosure** — a landing page claiming unqualified privacy while the policy discloses AI processing is the exact mismatch that draws regulatory scrutiny (`DECISIONS_quarterfinal.md` L065's record).

---
---

# F6 · PAYMENTS

**Design status:** substantially specified as of 2026-08-27 — `SCREEN-NOTES-F6-PAYMENTS.md`. Checkout is a redirect to Razorpay-hosted payment; Trackr never touches card details.

⚠️ **Two designs need designer work before the tasks depending on them can proceed** — Payment Failed (placeholder copy, no retry action) and Subscription Expiry (canvas exists but confirmed empty — designer hasn't built the expiry-state content yet). Do not build F6-6 or a downgrade-handling task until those are resolved.

## F6-DB

| ID | Task | Depends | Env | Notes |
|---|---|---|---|---|
| F6-0.1 | `PaymentProvider` interface | T5.1 pattern | ✅ | Mirrors `AIProvider` (L060) — Razorpay is the first and only adapter for MVP |
| F6-0.2 | `payment_transactions` table | T1.7 | ✅ | Order ID, Razorpay payment ID, status, amount — needed for the receipt panel and idempotency |

## F6-API

| ID | Task | Depends | Env | Notes |
|---|---|---|---|---|
| F6-1 | `POST /api/subscription/checkout` | F6-0.1, T2.3 | ⚙️ | Creates a Razorpay order, returns the redirect URL. Test mode locally via tunnel, live keys at deploy |
| F6-2 | Razorpay webhook handler | F6-1 | ⚙️ | ⚠️ **Idempotent, signature-verified.** A duplicate webhook must not grant two billing periods |
| F6-3 | `GET /api/subscription/status` | F6-2 | ✅ | Polling endpoint — resolves the confirmed webhook-race between browser and server |

## F6-Frontend

| ID | Component | Depends | Env | Notes |
|---|---|---|---|---|
| F6-4 | Checkout modal — billing cycle toggle, annual pre-selected | F6-1 | ✅ | `SCREEN-NOTES-F6-PAYMENTS.md` §2 |
| F6-5 | Verifying-payment modal state, non-dismissible | F6-3 | ✅ | Close icon disabled by design — user cannot dismiss mid-verification |
| F6-6 | Payment-failed modal state | Design revision | 🔴 blocked | **Needs real copy and a Retry action from the designer first** — current design is a visible draft |

## 🔴 Blocking / open

| | Item |
|---|---|
| — | Payment Failed screen — draft, needs designer revision before F6-6 |
| — | Subscription Expiry confirmed empty (fully read, 2026-08-27) — downgrade-handling task needs the designer to build this screen first |
| — | Cancellation flow — no design exists |
| — | Refunds, GST invoicing — no design, no schema |

**Reads:** `SCREEN-NOTES-F6-PAYMENTS.md` in full

---
---

# F3 · AI GENERATION

**Design status:** M06 fully specced (`TASKS-FRONTEND_quarterfinal.md`, `SCREEN-SPEC-M03.md`'s sibling for M06 not yet written). Rules complete — `AI-RULES.md` covers all 5 operations. Schema forward-declared in `DATABASE_quarterfinal.md` §4 (`documents`, `generation_jobs`, `ai_usage`) but never had migration tasks written. **This section closes that gap.**

⚠️ **F3 depends on F1's `AIProvider` interface (T5.1) and F2's `applications` table.** Cannot start before both are merged.

## F3-DB

| ID | Task | Depends | Env | Notes |
|---|---|---|---|---|
| F3-1.1 | `documents` table migration | F2-1.1, T5.1 | ✅ | `jd_snapshot` NULL = copy-on-write default (L090). `provider`/`model` columns for traceability |
| F3-1.2 | `generation_jobs` table migration | F2-1.1 | ✅ | `prompt_inputs JSONB` — profile + JD **snapshotted at enqueue**, not fetched at execution (L095) |
| F3-1.3 | `ai_usage` table migration | T1.2 | ✅ | ⚠️ **From the first generation, no exceptions** — cost/failure history cannot be reconstructed retroactively (L097) |
| F3-1.4 | `idx_jobs_queue` + `idx_ai_usage_*` indexes | F3-1.2, F3-1.3 | ✅ | Worker polling and cost-query performance |

## F3-Backend

| ID | Task | Depends | Env | Notes |
|---|---|---|---|---|
| F3-2.1 | `GeminiAdapter.generateCoverLetter()` | T5.2 | ⚙️ | `AI-RULES.md` §4. Plain text output, no JSON — nothing to parse means nothing to fail parsing |
| F3-2.2 | `GeminiAdapter.generateResume()` | T5.2 | ⚙️ | `AI-RULES.md` §5 — ⚠️ **strictest operation.** Every employer/date in output must appear in input, or the job is **rejected**, never saved |
| F3-2.3 | Output validation module | F3-2.1, F3-2.2 | ✅ | Length bounds, injection-marker detection, placeholder-bracket detection (`AI-RULES.md` §2.3) |
| F3-2.4 | Job queue worker (in-process, no Redis) | F3-1.2, T5.1 | ✅ | Polls `idx_jobs_queue`. Respects Gemini's 15 RPM (L034) — this is the actual reason a queue exists, not a nice-to-have |
| F3-2.5 | Quota enforcement — atomic decrement at enqueue | T1.7 | ✅ | The exact statement from `DATABASE_quarterfinal.md` §5. ⚠️ **A bug here is a billing event, not a UI bug** — designer's own words on M06 |
| F3-2.6 | Retry policy — 2 attempts, split by error class | F3-2.4 | ✅ | Auto-retry transient (timeout/429/5xx), fail immediately on permanent (400/safety/validation). Same for free and Pro — `AI-RULES.md` §8.1 |
| F3-2.7 | `ai_usage` logging — every call, no exceptions | F3-2.1, F3-2.2, F3-1.3 | ✅ | Tokens, cost, latency, status, `error_class`. **Never** prompts or outputs |
| F3-2.8 | JD copy-on-write trigger | F2-2.8, F3-1.1 | ✅ | On JD edit, copies the **old** value into documents that already used it |

## F3-API

| ID | Endpoint | Depends | Env | Notes |
|---|---|---|---|---|
| F3-3.1 | `POST /api/applications/:id/generate` | F3-2.4, F3-2.5 | ✅ | Enqueues, returns **immediately** — never blocks on the Gemini call (5s holding a DB connection is a DoS vector) |
| F3-3.2 | `GET /api/generate/:jobId/status` | F3-2.4 | ✅ | Polling endpoint for the M06 "Generating…" state — same pattern as F6-3's payment-verification poll |
| F3-3.3 | `POST /api/documents/:id/regenerate` | F3-3.1 | ✅ | ⚠️ **Decrements quota like any generation** (L109). Must show the cost before the click — M06 already specs this UI |
| F3-3.4 | `PATCH /api/documents/:id` (manual edit) | F3-1.1 | ✅ | The "Edit" action on M06 — **no AI call, no quota** |
| F3-3.5 | `GET /api/applications/:id/documents` | F3-1.1 | ✅ | Populates M05's Documents tab (currently an empty shell) |

## 🔴 Open

| | Question |
|---|---|
| — | Does `POST /generate` accept a `type` param (cover_letter/resume) as one endpoint, or two separate routes? Recommend one endpoint, `type` in the body — matches M06's single toggle |
| — | Job queue polling interval for F3-3.2 — 1s? 2s? Trade-off between responsiveness and request volume |

**Reads:** `AI-RULES.md` in full · `DATABASE_quarterfinal.md` §4 · `TASKS-FRONTEND_quarterfinal.md` M06 section

---
---

# P9 · OPERATIONS

**Confirmed in full scope.** Complete implementation notes: `P9-IMPLEMENTATION.md`.

| ID | Task | Depends | Env | One-line |
|---|---|---|---|---|
| T9.1 | `GET /api/health` | — | 🌐 | Zero dependencies, never touches DB — a DB-dependent check causes restart loops on a slow-but-working database |
| T9.2 | Nightly backup — in-container `pg_dump` → R2 | T1.1 | 🌐 | Private networking avoids exposing the DB publicly (L089) |
| T9.3 | Env validation at boot | — | ✅ | Fails fast on missing/malformed vars — build this into the Next.js scaffold immediately |
| T9.4 | Expired-row sweep | T1.5, T1.8, T1.9 | ✅ | `oauth_states`, `verification_tokens` (+7d), `auth_attempts` (90d). **`security_events` explicitly excluded** — it's the forensic record |
| T9.5 | **CI report-completeness check** | GitHub Actions setup | 🌐 | Parses PR bodies against `REPORTS.md`'s template. Fails the check if "Decisions made during implementation" is blank (not "None.") or if a "Noticed but not fixed" item has no follow-up task ID and no stated reason. Makes `GIT.md` §4 and `ISSUES.md` Gate 2's manual checklist items into an actual merge gate, enforced via required status checks on `main` (`GIT.md` §5) |

**T9.3 and T9.4 are startable now**, alongside P1 — they don't depend on anything deploy-specific despite living in the "Operations" name.

---
---

# TOTALS

| Group | Tasks | Startable now |
|---|---|---|
| F1 (P1–P7 + T7.5) | 34 | 34 |
| F2 | 14 | 14 |
| F3 | 17 | 17 (after F1's T5.1 and F2's F2-1.1 merge) |
| F4 | 9 | 9 (3 blocked pending design) |
| F0 | 11 | 11 |
| F6 | 8 | 6 (F6-6 blocked on designer revision) |
| P9 | 5 | 4 buildable now, T9.5 deploy-only (CI/GitHub Actions) |
| **Total** | **98** | **95 fully startable** — F6-6 and 3 of F4 blocked on design |

**Highest-risk tasks — extra review pass against `SECURITY_quarterfinal.md`:**

| ID | Why |
|---|---|
| T2.3 | Sole identity chokepoint — every authorization check depends on it |
| T4.3 | Account linking — get L069 wrong and ship a pre-registration takeover |
| T5.1 | `AIProvider` interface — reused by three features; a leaky abstraction here means provider lock-in everywhere |
| T7.5 | The only control needing environment-specific code — untestable locally, so review is the only safety net until deploy |
| F2-2.2 / F2-2.3 | Soft-delete filter — miss it once and a withdrawn application resurfaces |
| F3-2.2 | Resume tailoring — a fabricated employer on a real job application is the worst failure this product can produce. Output must be rejected, not saved, if it doesn't trace to the input |
| F3-2.5 | Quota decrement — designer's own words on M06: "a bug in this check isn't a UI bug, it's a billing event" |

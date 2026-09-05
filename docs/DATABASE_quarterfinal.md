# DATABASE_quarterfinal.md — Trackr

Complete schema for **F1 User Accounts** and **F2 Application Tracker**, with forward declarations for F3–F6.

Supersedes `DATABASE.md`. That file predates the mockup review and the pen.dev extraction; **six fields decided elsewhere never reached it**.

PostgreSQL 16, both environments (L088). Standard PG only — `citext` and `pgcrypto`, both universally available, preserving `pg_dump` portability (L025).

---

# 0 · WHAT CHANGED FROM `DATABASE.md`

| | Change | Source |
|---|---|---|
| `profiles.current_role` | **added** | L101 · M02 |
| `profiles.years_experience` + `months_experience` | **replaces the enum** | L107 |
| `profiles.location_preference` | free text → **enum** | L102 · M02 |
| `applications` | **entire table — new** | F2 |
| `applications.source` | **enum added** | L110 · M03/M04/M05 |
| `applications.last_activity_at` | **added** | `BOARD-COMPONENT.md` §7 |
| `applications.notes` | **added** | M05 §4.4 |
| `applications.assessment_due_at` | **added** | M03 `Due Fri` tag |
| `applications.interview_at` | **added** | M03 `Tue 3pm` tag |
| `applications.deleted_at` | **added** — soft delete | your decision |
| `application_events` | **new** — timeline | M05 §4.3 |
| `documents` | **new** | F3 forward |
| `generation_jobs` | **new** | L091 |
| `ai_usage` | **new** | L097 |
| `oauth_states` | **new** | G1 · was referenced, never defined |
| `subscriptions.trial_generations_limit` | **added** — 40 | L111 |

**Every one of these was decided in a document and never propagated here.** Worth re-running this audit after F3.

---

# 1 · RULES

1. Every schema change is a **migration**. Never modify the database by hand — local and production must be reproducible from the same files.
2. Every migration is **reversible**. Write the `down` before you trust the `up`.
3. **Invariants belong in the database** where expressible — `NOT NULL`, `UNIQUE`, `CHECK`, `FOREIGN KEY`. Application validation is a second layer, never the only one.
4. Every index needs a **stated reason**. Unjustified indexes cost writes.
5. **`user_id` is never taken from client input** — see `DATABASE-SECURITY.md`.
6. Timestamps are `TIMESTAMPTZ`, always.
7. Primary keys are UUID via `gen_random_uuid()` — no sequential IDs exposed to clients.

---

# 2 · IDENTITY (F1)

```sql
CREATE EXTENSION IF NOT EXISTS citext;
CREATE EXTENSION IF NOT EXISTS pgcrypto;
```

## 2.1 · users

```sql
CREATE TABLE users (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email             CITEXT NOT NULL UNIQUE,
  password_hash     TEXT,                    -- NULLABLE: SSO-only users (L068)
  email_verified_at TIMESTAMPTZ,
  timezone          TEXT NOT NULL,           -- IANA, e.g. 'Asia/Kolkata' (L041)
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);
```

`citext` blocks case-variant duplicate accounts. `password_hash` is nullable because SSO users have none — the "at least one credential" invariant spans tables and is enforced in §9.

## 2.2 · profiles

```sql
CREATE TYPE salary_period      AS ENUM ('monthly','annual');
CREATE TYPE location_pref      AS ENUM ('remote','hybrid','onsite');   -- L102
CREATE TYPE profile_source     AS ENUM ('manual','resume_upload','sso_prefill');

CREATE TABLE profiles (
  user_id             UUID PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  full_name           TEXT NOT NULL,
  current_role        TEXT,                                       -- L101 · M02
  target_role         TEXT,
  contact_email       CITEXT,                                     -- L050 · ≠ login email
  years_experience    SMALLINT CHECK (years_experience  BETWEEN 0 AND 60),   -- L107
  months_experience   SMALLINT CHECK (months_experience BETWEEN 0 AND 11),   -- L107
  skills              TEXT[] NOT NULL DEFAULT '{}',               -- L045 · lowercase
  salary_amount       NUMERIC(12,2),
  salary_currency     CHAR(3),                                    -- ISO 4217 · never geo-inferred
  salary_period       salary_period,
  location_preference location_pref,
  source              profile_source NOT NULL DEFAULT 'manual',
  completed_at        TIMESTAMPTZ,                                -- NULL ⇒ generation blocked (L098)
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT now(),

  CONSTRAINT salary_complete CHECK (
    (salary_amount IS NULL AND salary_currency IS NULL AND salary_period IS NULL)
    OR
    (salary_amount IS NOT NULL AND salary_currency IS NOT NULL AND salary_period IS NOT NULL)
  )
);
```

**Resolved (L125):** `SCREEN-SPEC-M02.md` §3.5 confirms `salary_period` is a real UI control — a monthly/annual toggle alongside the amount and currency fields, matching this schema exactly. No schema change from the original design.

**No `avatar_url`** — L082 takes the Google name claim only. Adding a photo later is one nullable column.

**Experience is years + months, no enum** (L107). The junior/mid/senior/lead enum was never in the PRD or the mockups — it was my proposal, and it's dropped. Retained here as a comment for traceability:

```sql
-- SUPERSEDED by L107 — kept for traceability, do not create:
-- CREATE TYPE experience_level AS ENUM ('junior','mid','senior','lead');
-- Rationale: Indian ATS and HR systems ask years+months; LinkedIn does the same.
-- Neither the PRD (p.11, p.13) nor mockup 02 specified an enum.
```

## 2.3 · sessions

```sql
CREATE TABLE sessions (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token_hash TEXT NOT NULL UNIQUE,           -- SHA-256; raw token NEVER stored
  expires_at TIMESTAMPTZ NOT NULL,
  revoked_at TIMESTAMPTZ,
  user_agent TEXT,
  ip         INET,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_sessions_lookup ON sessions(token_hash) WHERE revoked_at IS NULL;
CREATE INDEX idx_sessions_user   ON sessions(user_id);
```

## 2.4 · verification_tokens + email_log

```sql
CREATE TYPE token_purpose AS ENUM ('verify_email','change_email','password_reset');

CREATE TABLE verification_tokens (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token_hash TEXT NOT NULL,                  -- hash of the 6-digit OTP (L071)
  purpose    token_purpose NOT NULL,
  new_email  CITEXT,                         -- 'change_email' only
  attempts   SMALLINT NOT NULL DEFAULT 0,    -- lock at 5 (L071)
  expires_at TIMESTAMPTZ NOT NULL,           -- issued + 10 minutes
  used_at    TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_tokens_active ON verification_tokens(user_id, purpose) WHERE used_at IS NULL;

CREATE TABLE email_log (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id             UUID REFERENCES users(id) ON DELETE SET NULL,
  recipient           CITEXT NOT NULL,
  purpose             TEXT NOT NULL,
  provider_message_id TEXT,
  sent_at             TIMESTAMPTZ,
  failed_at           TIMESTAMPTZ,
  error               TEXT,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_email_log_quota ON email_log(sent_at) WHERE sent_at IS NOT NULL;
```

`email_log` serves send tracking **and** the daily counter for Brevo's 300/day cap (L036). **Body content is never stored.**

## 2.5 · oauth_accounts + oauth_states

```sql
CREATE TYPE oauth_provider AS ENUM ('google','linkedin');

CREATE TABLE oauth_accounts (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id          UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  provider         oauth_provider NOT NULL,
  provider_user_id TEXT NOT NULL,            -- OIDC 'sub' — stable, NEVER the email
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (provider, provider_user_id)
);

CREATE INDEX idx_oauth_user ON oauth_accounts(user_id);

-- In-flight OAuth handshakes. Required by SECURITY-CONTROLS.md §1 (gap G1).
-- Without this the callback cannot verify `state`, and an attacker can link a
-- victim's session to their own Google account.
CREATE TABLE oauth_states (
  state_hash    TEXT PRIMARY KEY,            -- SHA-256; raw value lives only in the cookie
  provider      oauth_provider NOT NULL,
  code_verifier TEXT NOT NULL,               -- PKCE
  redirect_path TEXT,                        -- allow-listed internal path ONLY, never a URL
  user_id       UUID REFERENCES users(id) ON DELETE CASCADE,   -- set when linking from Settings
  expires_at    TIMESTAMPTZ NOT NULL,        -- issued + 10 minutes
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_oauth_states_expiry ON oauth_states(expires_at);
```

**Key `oauth_accounts` on `sub`, not email** — users change their Google email; `sub` is permanent.
**No tokens stored** — OAuth is used for identity only, never to call Google APIs. Nothing to leak, nothing to refresh.
**`oauth_states` rows are deleted on consume**, not marked. A surviving row is a replay waiting to happen.

## 2.6 · subscriptions + generation_quota

```sql
CREATE TYPE subscription_tier   AS ENUM ('free','pro');
CREATE TYPE subscription_status AS ENUM ('trialing','active','past_due','cancelled');

CREATE TABLE subscriptions (
  user_id                   UUID PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  tier                      subscription_tier   NOT NULL DEFAULT 'free',
  status                    subscription_status NOT NULL DEFAULT 'trialing',
  trial_ends_at             TIMESTAMPTZ,       -- signup + 12 days
  trial_generations_limit   SMALLINT NOT NULL DEFAULT 40,   -- L111
  trial_generations_used    SMALLINT NOT NULL DEFAULT 0,
  current_period_end        TIMESTAMPTZ,
  provider                  TEXT,              -- 'razorpay' — NULL until F6
  provider_subscription_id  TEXT,
  created_at                TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at                TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE generation_quota (
  user_id      UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  period_start DATE NOT NULL,                 -- first of the calendar month
  used         INT  NOT NULL DEFAULT 0,
  PRIMARY KEY (user_id, period_start)
);
```

**Quota is separate from subscription** because the cycles differ — quota resets on the calendar month, billing on the subscription anniversary. Merging them resets a 20th-of-the-month subscriber's quota on the 20th.

**Trial counters live on `subscriptions`** because the trial is a fixed 40 total (L111), not a monthly cycle.

## 2.7 · auth_attempts + security_events

```sql
CREATE TABLE auth_attempts (
  id         BIGSERIAL PRIMARY KEY,
  identifier TEXT NOT NULL,                  -- IP or email
  succeeded  BOOLEAN NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_auth_attempts ON auth_attempts(identifier, created_at DESC);

CREATE TABLE security_events (
  id         BIGSERIAL PRIMARY KEY,
  event_type TEXT NOT NULL,
  user_id    UUID REFERENCES users(id) ON DELETE SET NULL,
  ip         INET,
  user_agent TEXT,
  metadata   JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_security_events      ON security_events(event_type, created_at DESC);
CREATE INDEX idx_security_events_user ON security_events(user_id, created_at DESC);
```

Neither cascades from `users` — both must survive account deletion for forensic value, and `auth_attempts` must log attempts against accounts that never existed.

**Event types:** `login_failed` · `login_success` · `rate_limit_tripped` · `otp_failed` · `otp_locked` · `password_invalidated_by_oauth_link` · `email_changed` · `oauth_linked` · `oauth_unlinked` · `oauth_state_mismatch` · `permission_denied` · `session_resolution_failed`

⚠️ **Never** put passwords, OTPs, tokens, résumé content, or job descriptions in `metadata`.

---

# 3 · APPLICATION TRACKER (F2)

## 3.1 · applications

```sql
CREATE TYPE application_status AS ENUM
  ('saved','applied','assessment','interview','offer','rejected');   -- L104
CREATE TYPE application_source AS ENUM
  ('linkedin','naukri','indeed','referral','company_site','other');  -- L110

CREATE TABLE applications (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id           UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,

  company           TEXT NOT NULL,           -- required (designer note, M04)
  role              TEXT NOT NULL,           -- required
  status            application_status NOT NULL DEFAULT 'saved',

  job_description   TEXT CHECK (char_length(job_description) <= 15000),   -- L103 · M04
  source            application_source,      -- optional · M03 filter, M05 chip
  source_url        TEXT,                    -- http/https only, validated in app (L110)

  date_applied      DATE,
  assessment_due_at TIMESTAMPTZ,             -- M03 "Due Fri" tag
  interview_at      TIMESTAMPTZ,             -- M03 "Tue 3pm" tag · written by F5
  notes             TEXT,                    -- M05 §4.4

  last_activity_at  TIMESTAMPTZ NOT NULL DEFAULT now(),   -- board sort
  deleted_at        TIMESTAMPTZ,             -- soft delete · trash

  created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- One composite index serves the entire board: scope, group, sort.
CREATE INDEX idx_applications_board
  ON applications (user_id, status, last_activity_at DESC)
  WHERE deleted_at IS NULL;

-- Trash view
CREATE INDEX idx_applications_trash
  ON applications (user_id, deleted_at DESC)
  WHERE deleted_at IS NOT NULL;
```

### Only `company` and `role` are required

Designer's note, M04: *"a tracker that refuses partial records doesn't get used during a burst of applying."* Resist adding `NOT NULL`.

### `last_activity_at` — updated by

status change · note edit · call log · document generated · reminder set · JD edit.
Drives the board's "oldest activity first" sort, which surfaces stale applications — the PRD's page-7 thesis.

### Soft delete, then hard delete

Your decision: delete is available only from the Rejected column → sets `deleted_at` → row moves to trash → user later empties trash, which hard-deletes.

⚠️ **Every board and list query must filter `deleted_at IS NULL`.** Missing it once resurrects deleted applications. The partial indexes make the correct path also the fast one.

**Children are not soft-deleted** — they stay intact and are filtered by the parent's `deleted_at`. Hard delete cascades normally.

### `source_url` security (L110)

Scheme allow-list `http`/`https` at input. Reject `javascript:`, `data:`, `file:`, `vbscript:`. **Never fetched server-side** (L081/G9). Rendered with `rel="noopener noreferrer"`.

⚠️ **`job_description` is untrusted input reaching an LLM prompt.** See `AI-RULES.md` §2.1 — prompt injection.

## 3.2 · application_events — the timeline

```sql
CREATE TYPE event_type AS ENUM
  ('created','status_changed','document_generated','call_logged',
   'follow_up_sent','reminder_set','note_updated');

CREATE TABLE application_events (
  id             BIGSERIAL PRIMARY KEY,
  application_id UUID NOT NULL REFERENCES applications(id) ON DELETE CASCADE,
  user_id        UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  type           event_type NOT NULL,
  description    TEXT NOT NULL,              -- "Status changed to Interview"
  metadata       JSONB NOT NULL DEFAULT '{}',
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_events_application ON application_events(application_id, created_at DESC);
```

**Append-only. Never updated, never deleted** except by cascade.

Designer's note, M05: *"Status changes from here and from the board drag. Both write the same timeline event — one code path, two entry points."*

⚠️ **Debounce status events 2 seconds.** Fidgety board drags otherwise produce five entries (`BOARD-COMPONENT.md` §8).

---

# 3.3 · FOLLOW-UP SYSTEM (F4)

Added 2026-08-27 — was missing despite `TASKS_quarterfinal.md` referencing these tables. Decisions: L119, L120.

```sql
CREATE TYPE reminder_type   AS ENUM ('application_followup','post_interview');
CREATE TYPE reminder_status AS ENUM ('pending','snoozed','sent','dismissed');

CREATE TABLE reminders (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id        UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  application_id UUID NOT NULL REFERENCES applications(id) ON DELETE CASCADE,
  type           reminder_type   NOT NULL,
  status         reminder_status NOT NULL DEFAULT 'pending',
  due_at         TIMESTAMPTZ NOT NULL,        -- computed in the user's timezone (L041)
  snoozed_until  TIMESTAMPTZ,
  draft_content  TEXT,                        -- generated once, then editable
  sent_at        TIMESTAMPTZ,                 -- user-confirmed — Trackr does not send (L038, pending)
  dismissed_at   TIMESTAMPTZ,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT now(),

  UNIQUE (application_id, type)               -- one of each rule per application
);

CREATE INDEX idx_reminders_queue ON reminders (user_id, due_at)
  WHERE status IN ('pending','snoozed');

-- Lives on applications, not reminders — the board's derived Follow-up tag
-- (see F2-3.4 in TASKS-FRONTEND_quarterfinal.md) must stay computable from
-- F2 tables alone, without any F4 table existing (L120).
ALTER TABLE applications
  ADD COLUMN follow_up_snoozed_until TIMESTAMPTZ;
```

⚠️ **`UNIQUE (application_id, type)`** prevents the scheduler producing duplicate reminders for one application on a double run.
⚠️ **`sent_at` means "the user told us they sent it."** Trackr drafts, the user sends (L038 record — pending your confirmation, evidence currently one-sided toward copy-only).
⚠️ **Snooze hides the derived tag; a failed send does not** — a system failure must stay visible, a user's own deferral shouldn't nag (L120).

**Deletion:** cascades from both `users` and `applications` — add to §6's graph below.

---

# 4 · FORWARD DECLARATIONS (F3, F6)

Defined now so F2 tasks can reference them, and so F6's newly-designed checkout flow (`SCREEN-NOTES-F6-PAYMENTS.md`) has real DDL rather than a task pointing at nothing. **Built with their features** — F3's tables when generation work starts, F6's when payments does.

```sql
CREATE TYPE document_type AS ENUM ('cover_letter','resume');

CREATE TABLE documents (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  application_id UUID NOT NULL REFERENCES applications(id) ON DELETE CASCADE,
  user_id        UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  type           document_type NOT NULL,
  content        TEXT NOT NULL,              -- canonical text (L028)
  jd_snapshot    TEXT,                       -- NULL ⇒ same as application's current JD (L090)
  provider       TEXT NOT NULL,              -- 'gemini' (L060)
  model          TEXT NOT NULL,
  r2_key         TEXT,                       -- only when a Pro user saves a PDF (L062)
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_documents_application ON documents(application_id, created_at DESC);
```

**Copy-on-write (L090):** `jd_snapshot` NULL means "same as the application's current JD". On JD edit, copy the **old** value into every document that used it, then update. Users who never edit pay zero extra bytes.

```sql
CREATE TYPE job_status AS ENUM ('queued','running','succeeded','failed');

CREATE TABLE generation_jobs (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id        UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  application_id UUID NOT NULL REFERENCES applications(id) ON DELETE CASCADE,
  type           document_type NOT NULL,
  status         job_status NOT NULL DEFAULT 'queued',
  attempts       SMALLINT NOT NULL DEFAULT 0,        -- max 2 (L096)
  error_class    TEXT,
  prompt_inputs  JSONB NOT NULL,                     -- profile + JD snapshotted at enqueue (L095)
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  completed_at   TIMESTAMPTZ
);

CREATE INDEX idx_jobs_queue ON generation_jobs(status, created_at) WHERE status IN ('queued','running');
CREATE INDEX idx_jobs_user  ON generation_jobs(user_id, created_at DESC);

CREATE TABLE ai_usage (
  id            BIGSERIAL PRIMARY KEY,
  user_id       UUID REFERENCES users(id) ON DELETE SET NULL,
  job_id        UUID,
  provider      TEXT NOT NULL,
  model         TEXT NOT NULL,
  operation     TEXT NOT NULL,               -- extract_profile · cover_letter · …
  tokens_in     INT,
  tokens_out    INT,
  cost_estimate NUMERIC(10,6),
  latency_ms    INT,
  status        TEXT NOT NULL,
  error_class   TEXT,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_ai_usage_cost ON ai_usage(created_at DESC);
CREATE INDEX idx_ai_usage_user ON ai_usage(user_id, created_at DESC);
```

⚠️ **`ai_usage` from the first generation** (L097). You cannot reconstruct last month's spend afterwards. **Never** stores prompts or outputs.

**Queue depth cap (L094):** 2 pending jobs free, 5 Pro. Enforced in the service, rejected with a visible message.

---

# 4.1 · F6 — PAYMENT TRANSACTIONS

Backing table for the checkout flow read from `Admin.pen` (`SCREEN-NOTES-F6-PAYMENTS.md`). Required for F6-2's webhook idempotency and the receipt panel shown on both success and failure states.

```sql
CREATE TYPE payment_status AS ENUM ('created','verifying','succeeded','failed','refunded');

CREATE TABLE payment_transactions (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id               UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  razorpay_order_id     TEXT NOT NULL UNIQUE,      -- set at F6-1, before payment starts
  razorpay_payment_id   TEXT UNIQUE,                -- set once Razorpay confirms — NULL until then
  status                payment_status NOT NULL DEFAULT 'created',
  amount                NUMERIC(10,2) NOT NULL,     -- INR, matching the plan price at purchase time
  billing_cycle         TEXT NOT NULL,               -- 'monthly' | 'annual' — mirrors the checkout modal's toggle
  failure_reason         TEXT,                        -- populated on 'failed', shown on the Payment Failed screen
  created_at            TIMESTAMPTZ NOT NULL DEFAULT now(),
  confirmed_at          TIMESTAMPTZ                -- set when the webhook lands — this is what F6-3's polling endpoint checks
);

CREATE INDEX idx_payment_transactions_user ON payment_transactions(user_id, created_at DESC);
```

⚠️ **`razorpay_payment_id` is the idempotency key for the webhook handler (F6-2).** A duplicate webhook delivery for the same payment must be a no-op — check this column before applying any state change, never process a webhook by `razorpay_order_id` alone, since an order can legitimately receive more than one webhook call (e.g. a retry) referencing the same payment.

⚠️ **`confirmed_at` is exactly what F6-3's `GET /api/subscription/status` polls for.** The Verifying-payment screen (`SCREEN-NOTES-F6-PAYMENTS.md` §3) exists because Razorpay confirms to the browser before the webhook reaches the server — this column is the source of truth the frontend is waiting on, not a client-side timer or assumption.

⚠️ **`status='created'` rows with no `razorpay_payment_id`** represent an abandoned checkout — the user opened the modal, an order was created, but they never completed payment. Harmless, but worth excluding from any revenue reporting.

**Not yet added — depends on the still-unread Subscription Expiry screen** (`SCREEN-NOTES-F6-PAYMENTS.md` §5): any column tracking a grace period or downgrade date. Adding this now would be guessing at content I haven't confirmed exists.

---

# 5 · THE QUOTA STATEMENT

The single most important query in the system. Designer's note, M06: *"A bug in this check isn't a UI bug, it's a billing event."*

```sql
UPDATE generation_quota
   SET used = used + 1
 WHERE user_id = $1
   AND period_start = date_trunc('month', now())::date
   AND used < $2                     -- 5 free · 40 trial · 300 Pro fair use
RETURNING used;
```

**One statement. Check and decrement are atomic** — fifty rapid clicks produce five jobs and forty-five rejections (L092).
No row returned ⇒ refuse to enqueue.
**Refund on permanent failure:** `used = used - 1`.

---

# 6 · DELETION GRAPH

```
users
 ├─ profiles              CASCADE
 ├─ sessions              CASCADE
 ├─ verification_tokens   CASCADE
 ├─ oauth_accounts        CASCADE
 ├─ oauth_states          CASCADE
 ├─ subscriptions         CASCADE
 ├─ payment_transactions  CASCADE
 ├─ generation_quota      CASCADE
 ├─ applications          CASCADE
 │   ├─ application_events CASCADE
 │   ├─ documents          CASCADE
 │   ├─ generation_jobs    CASCADE
 │   └─ reminders          CASCADE   (also cascades from users directly)
 ├─ email_log             SET NULL    (keep send history)
 ├─ security_events       SET NULL    (keep forensic record)
 └─ ai_usage              SET NULL    (keep cost history)
```

Deleting a user is **one transaction, no orphans** — DPDP requirement (L064). Verified by security test #12.

⚠️ **`applications.deleted_at` (soft) is distinct from a `users` cascade (hard).** Trash holds soft-deleted applications; account deletion removes everything regardless.

---

# 7 · INDEX JUSTIFICATION

| Index | Serves | Frequency |
|---|---|---|
| `idx_sessions_lookup` | Session resolution | **Every authenticated request** — the hottest query. Partial keeps it small |
| `idx_sessions_user` | Log out all devices; cascade | Low, but an unindexed FK cascade on a growing table is a latent problem |
| `idx_tokens_active` | Find outstanding OTP | Every verification attempt |
| `idx_oauth_user` | Connected accounts; cascade | Settings |
| `idx_oauth_states_expiry` | Sweep expired handshakes | Periodic |
| **`idx_applications_board`** | **The entire board** — scope, group, sort | Every board load |
| `idx_applications_trash` | Trash view | Rare |
| `idx_events_application` | Timeline | Every detail view |
| `idx_documents_application` | Documents tab | Every detail view |
| `idx_jobs_queue` | Worker polling | Every tick |
| `idx_reminders_queue` | Reminder queue screen, scheduler scan | Every scheduler tick + queue load |
| `idx_auth_attempts` | Rate-limit window | Every login attempt |
| `idx_email_log_quota` | Daily Brevo count | Per send |
| `idx_ai_usage_*` | Cost and support queries | Rare, useless without |

**Not indexed:** `users.email` (UNIQUE already creates one) · `profiles.skills` (no search in MVP — add GIN when one exists) · `applications.company` (search runs over ~240 rows; revisit past ~10,000 per user).

---

# 8 · MIGRATION ORDER

| # | Task | Creates |
|---|---|---|
| 1 | T1.1 | tooling + baseline |
| 2 | T1.2 | extensions, `users` |
| 3 | T1.3 | enums, `profiles` ⚠️ **blocked on the salary-period question** |
| 4 | T1.4 | `sessions` |
| 5 | T1.5 | `verification_tokens`, `email_log` |
| 6 | T1.6 | `oauth_accounts` |
| 7 | T1.9 | `oauth_states` |
| 8 | T1.7 | `subscriptions`, `generation_quota` |
| 9 | T1.8 | `auth_attempts`, `security_events` |
| 10 | F2-1.1 | `applications` |
| 11 | F2-1.3 | `application_events` |
| 12 | F3 | `documents`, `generation_jobs`, `ai_usage` |
| 13 | F4-1.1 | `reminders`, `applications.follow_up_snoozed_until` |
| 14 | F6-0.2 | `payment_transactions` |

**Expand/contract for anything touching deployed data.** Locally it feels like overkill; the habit is what matters once production exists.

---

# 9 · CROSS-TABLE INVARIANT

**A user must always have at least one usable credential** — a password, or a linked OAuth account. Otherwise they are permanently locked out.

Spans two tables, so no simple `CHECK`. Enforced in the service layer, verified by test:

```
Remove the last oauth_account from a user with password_hash IS NULL  ⇒ REJECT
Remove the password from a user with no oauth_accounts row            ⇒ REJECT
```

Same rule in the Settings connected-accounts screen (T4.5).

---

# 10 · LOCAL vs PRODUCTION

**The schema is identical.** Same migrations, same order, same Postgres 16 (L088).

| | Local | Production |
|---|---|---|
| Postgres | Docker `postgres:16-alpine` | Railway plugin, default 16 |
| Connection | `docker-compose` | injected `DATABASE_URL` |
| TLS | off | **required** |
| Credentials | in `.env`, not committed | platform secrets |
| Superuser | container default | **application user is NOT superuser** — DML + migration rights only |
| Backups | none needed | nightly `pg_dump` → R2, **in-container** (L089) |
| Migrations | `npm run migrate` | deployment pipeline, **never by hand** |

⚠️ **No production credentials in any developer or agent environment** (L064). Diagnosis via the platform's query console (`SUPPORT.md` §2).

⚠️ **Railway databases are private by default.** Exposing one creates a TCP proxy and incurs egress billing — which is why the backup job runs inside the app container (L089).

---

# 11 · OPEN

| | Question | Blocks |
|---|---|---|
| 🔴 | **Salary period** — separate control, or "/ year" fixed? | T1.3 |
| 🟠 | Call transcript retention period | F5 |
| 🟠 | `auth_attempts` / `security_events` retention — 90 days suggested | T9.4 |
| 🟡 | Does emptying trash hard-delete immediately, or after a grace period? | F2-2.5 |

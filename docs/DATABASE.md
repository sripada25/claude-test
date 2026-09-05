# DATABASE.md — Trackr

PostgreSQL, standard only — no vendor extensions beyond `citext` and `pgcrypto`, both of which exist everywhere. This preserves `pg_dump` portability (L025).

**Supersedes** `FEATURE-A-SPEC.md` §4, which predates SSO (L068) and OTP (L071).

---

# 1 · RULES

1. **Every schema change is a migration.** Never modify the database by hand — local and production must be reproducible from the same files.
2. **Every migration is reversible.** Write the `down` before you're confident about the `up`.
3. **Invariants belong in the database** where they can be expressed — `NOT NULL`, `UNIQUE`, `CHECK`, `FOREIGN KEY`. Application validation is a second layer, not the only one.
4. **Every index needs a stated reason.** Unjustified indexes cost writes.
5. **`user_id` is never taken from client input.** See `DATABASE-SECURITY.md`.
6. Timestamps are `TIMESTAMPTZ`, always. Never `TIMESTAMP`.
7. Primary keys are UUID via `gen_random_uuid()` — no sequential IDs exposed to clients.

---

# 2 · SCHEMA

```sql
CREATE EXTENSION IF NOT EXISTS citext;
CREATE EXTENSION IF NOT EXISTS pgcrypto;
```

## 2.1 · users

```sql
CREATE TABLE users (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email             CITEXT NOT NULL UNIQUE,
  password_hash     TEXT,                    -- NULLABLE: SSO-only users have none (L068)
  email_verified_at TIMESTAMPTZ,
  timezone          TEXT NOT NULL,           -- IANA, e.g. 'Asia/Kolkata' (L041)
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);
```

`citext` blocks accounts differing only by case. `password_hash` became nullable when SSO was added — enforcement that a user has *at least one* credential is in §3.

## 2.2 · profiles

```sql
CREATE TYPE experience_level AS ENUM ('junior','mid','senior','lead');
CREATE TYPE salary_period    AS ENUM ('monthly','annual');
CREATE TYPE profile_source   AS ENUM ('manual','resume_upload','sso_prefill');

CREATE TABLE profiles (
  user_id             UUID PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  full_name           TEXT NOT NULL,
  contact_email       CITEXT,                -- L050: ≠ login email; Reply-To for recruiters
  skills              TEXT[] NOT NULL DEFAULT '{}',
  experience_level    experience_level NOT NULL,
  target_role         TEXT NOT NULL,
  salary_amount       NUMERIC(12,2),
  salary_currency     CHAR(3),
  salary_period       salary_period,
  location_preference TEXT,
  source              profile_source NOT NULL DEFAULT 'manual',
  completed_at        TIMESTAMPTZ,           -- NULL ⇒ app access blocked (L047)
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT now(),

  CONSTRAINT salary_complete CHECK (
    (salary_amount IS NULL AND salary_currency IS NULL AND salary_period IS NULL)
    OR
    (salary_amount IS NOT NULL AND salary_currency IS NOT NULL AND salary_period IS NOT NULL)
  )
);
```

**No `avatar_url` column.** L082: name only. Adding a photo later is one nullable column and one migration — deliberately not pre-built.

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

CREATE INDEX idx_tokens_active ON verification_tokens(user_id, purpose)
  WHERE used_at IS NULL;

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

`email_log` serves two purposes: send tracking, and the daily counter for Brevo's 300/day cap (L036). Body content is **never** stored.

## 2.5 · oauth_accounts + oauth_states

```sql
CREATE TYPE oauth_provider AS ENUM ('google','linkedin');

CREATE TABLE oauth_accounts (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id          UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  provider         oauth_provider NOT NULL,
  provider_user_id TEXT NOT NULL,            -- the OIDC 'sub' claim — stable, never the email
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now(),

  UNIQUE (provider, provider_user_id)
);

CREATE INDEX idx_oauth_user ON oauth_accounts(user_id);
```

**Key it on `sub`, not email.** Users can change their Google email; `sub` is permanent. Keying on email means an email change orphans the link.

**No tokens stored.** Trackr uses OAuth for identity only, never to call Google APIs on the user's behalf. Nothing to leak, nothing to refresh.

```sql
-- In-flight OAuth handshakes. Required by SECURITY-CONTROLS.md §1 (gap G1).
-- Without this, the callback cannot verify `state` and an attacker can link a
-- victim's session to their own Google account.
CREATE TABLE oauth_states (
  state_hash     TEXT PRIMARY KEY,           -- SHA-256; raw value lives only in the cookie
  provider       oauth_provider NOT NULL,
  code_verifier  TEXT NOT NULL,              -- PKCE
  redirect_path  TEXT,                       -- allow-listed internal path only, never a full URL
  user_id        UUID REFERENCES users(id) ON DELETE CASCADE,  -- set when linking from settings
  expires_at     TIMESTAMPTZ NOT NULL,       -- issued + 10 minutes
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_oauth_states_expiry ON oauth_states(expires_at);
```

**Single use — delete the row on consume, don't mark it.** A row that still exists after use is a replay waiting to happen.

`redirect_path` stores an internal path (`/profile`), never a full URL. Accepting a URL here is an open redirect (§1).

## 2.6 · subscriptions + generation_quota

```sql
CREATE TYPE subscription_tier   AS ENUM ('free','pro');
CREATE TYPE subscription_status AS ENUM ('trialing','active','past_due','cancelled');

CREATE TABLE subscriptions (
  user_id            UUID PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  tier               subscription_tier   NOT NULL DEFAULT 'free',
  status             subscription_status NOT NULL DEFAULT 'trialing',
  trial_ends_at      TIMESTAMPTZ,
  current_period_end TIMESTAMPTZ,
  provider           TEXT,                   -- NULL until F6
  created_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at         TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE generation_quota (
  user_id      UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  period_start DATE NOT NULL,                -- first of calendar month
  used         INT  NOT NULL DEFAULT 0,
  PRIMARY KEY (user_id, period_start)
);
```

**Why quota is separate from subscription:** the quota cycle is the calendar month; the billing cycle is the subscription anniversary. Merging them resets a 20th-of-the-month subscriber's quota on the 20th.

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

CREATE INDEX idx_security_events ON security_events(event_type, created_at DESC);
CREATE INDEX idx_security_events_user ON security_events(user_id, created_at DESC);
```

Neither references `users` with a cascade — both must survive account deletion for forensic value, and `auth_attempts` must log attempts against accounts that never existed.

**Event types to emit:** `login_failed` · `login_success` · `rate_limit_tripped` · `otp_failed` · `otp_locked` · `password_invalidated_by_oauth_link` · `email_changed` · `oauth_linked` · `oauth_state_mismatch` · `permission_denied`.

**Never** put passwords, OTPs, tokens, or resume content in `metadata`.

---

# 3 · CROSS-TABLE INVARIANT

**A user must always have at least one usable credential** — a password, or a linked OAuth account. Otherwise they are permanently locked out.

Not expressible as a simple `CHECK` (it spans tables). Enforce in the service layer and verify with a test:

```
Removing the last OAuth account from a user with password_hash IS NULL
  ⇒ must be rejected
Removing a password from a user with no oauth_accounts row
  ⇒ must be rejected
```

Same rule in the UI's connected-accounts screen.

---

# 4 · DELETION GRAPH

```
users
 ├─ profiles              CASCADE
 ├─ sessions              CASCADE
 ├─ verification_tokens   CASCADE
 ├─ oauth_accounts        CASCADE
 ├─ oauth_states          CASCADE
 ├─ subscriptions         CASCADE
 ├─ generation_quota      CASCADE
 ├─ email_log             SET NULL   (keep send history, drop the link)
 └─ security_events       SET NULL   (keep forensic record)
```

Deleting a user is one transaction and leaves no orphans — required by DPDP (L064). Verified by test #12 in `SECURITY.md`.

---

# 5 · INDEX JUSTIFICATION

| Index | Serves | Frequency |
|---|---|---|
| `idx_sessions_lookup` | Session resolution | **Every authenticated request** — highest-frequency query in the system. Partial index keeps it small. |
| `idx_sessions_user` | "Log out all devices", cascade delete | Low, but an unindexed FK cascade on a growing table is a latent problem |
| `idx_tokens_active` | Find a user's outstanding OTP | Every verification attempt |
| `idx_oauth_user` | List linked accounts; cascade | Settings page |
| `idx_oauth_states_expiry` | Sweep expired handshakes | Periodic cleanup |
| `idx_auth_attempts` | Rate-limit window count | Every login attempt |
| `idx_email_log_quota` | Daily Brevo send count | Once per send |
| `idx_security_events*` | Incident review | Rare, but useless without |

**Not indexed:** `users.email` (the `UNIQUE` constraint already creates one) · `profiles.skills` (no search feature in MVP — add GIN only when one exists).

---

# 6 · MIGRATIONS

Expand/contract for anything touching deployed data:

```
1. Add the new column as nullable
2. Deploy code that writes both old and new
3. Backfill in batches
4. Deploy code that reads new
5. Drop the old column
```

Never in one step on a table with data. Locally this feels like overkill — the habit is what matters once production exists.

**Before writing any migration, ask:** does this lock the table? Does it rewrite it? Can the currently-deployed code still run against both the old and new schema?

---

# 7 · BACKUPS (L026, L089)

Nightly `pg_dump` to Cloudflare R2. Provider-independent artifact — the escape hatch that makes L025 real rather than theoretical.

**The job runs inside the app container** (L089), not as a separate service.

Railway databases are private by default. Exposing one creates a TCP Proxy and
incurs network egress billing — so an external dump would either cost money and
put the database on the internet, or require a second service (contradicting
L030). Running the job in-container uses private networking: no extra service,
no egress, no public exposure.

Railway's native Backups feature is a useful complement, but it's platform-specific.
`pg_dump` → R2 is what satisfies L025.

**Rehearse the restore.** A backup that has never been restored is not a backup.
Do it once against a scratch database before launch.

# 8 · VERSION

**PostgreSQL 16, both environments** (L088). Railway's provisioning default;
`docker-compose.yml` pins `postgres:16-alpine` to match.

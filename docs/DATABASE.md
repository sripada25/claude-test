# Database

PostgreSQL on Railway, not Supabase. See
[AGENTS.md](../AGENTS.md) §0, Decision 2 for the reasoning — this is a
deliberate tradeoff (no free bundled auth/storage) accepted for a
single-vendor, single-infrastructure-provider setup on Railway.

**No tables exist yet.** The schema below is the proposal derived from
the product specification's data model, translated into concrete
Postgres DDL. It needs review before the first migration is written —
this doc is the thing to review, not a fait accompli.

## Tooling

- **Driver:** `pg` (node-postgres)
- **Schema / migrations:** Drizzle ORM + Drizzle Kit — TypeScript-native,
  generates SQL migrations from a typed schema definition, and keeps the
  schema and the application's types in one place rather than drifting
  apart. (A lighter alternative, if an ORM is unwanted: `node-pg-migrate`
  with hand-written SQL migrations. Pick one before Phase 1 — do not mix
  both.)
- **Validation at the API boundary:** Zod, matched to the Drizzle schema
  types where practical

## Rules

- Every schema change is a migration. Never manually modify the
  production schema outside of one.
- Every migration has: the migration itself, a rollback strategy where
  practical, test coverage, and a written explanation of data impact.
- Foreign keys where a relationship exists.
- Unique constraints for identities and business invariants (e.g. one
  `(provider, provider_user_id)` pair per `auth_identities` row).
- Indexes based on actual query patterns — not speculative indexing on
  every column.
- UTC timestamps throughout (`timestamptz`, not `timestamp`).
- Never store plaintext passwords or plaintext payment secrets.
- Never store OAuth client secrets in the database or in source — they
  are environment variables, see `docs/ENVIRONMENT.md`.
- Prefer immutable records for security-sensitive events (e.g. an
  append-only login-attempt log) rather than rows that get overwritten.

## Proposed schema

```sql
-- users: one row per person, independent of how they log in
CREATE TABLE users (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email               text NOT NULL UNIQUE,
  name                text,
  skills              text[],
  experience_level    text,
  target_role         text,
  salary_expectation  text,
  location_preference text,
  created_at          timestamptz NOT NULL DEFAULT now(),
  updated_at          timestamptz NOT NULL DEFAULT now()
);

-- auth_identities: one or more login methods per user
CREATE TABLE auth_identities (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id           uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  provider          text NOT NULL,              -- 'local' | 'google'
  provider_user_id  text,                        -- google_sub; null for local
  password_hash     text,                        -- argon2id; null unless provider = 'local'
  created_at        timestamptz NOT NULL DEFAULT now(),
  UNIQUE (provider, provider_user_id),
  UNIQUE (user_id, provider)
);

-- applications: the primary object everything else connects to
CREATE TABLE applications (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id      uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  company      text NOT NULL,
  role         text NOT NULL,
  jd_text      text,
  date_applied date,
  status       text NOT NULL DEFAULT 'saved',   -- saved|applied|assessment|interview|offer|rejected
  source_url   text,
  created_at   timestamptz NOT NULL DEFAULT now(),
  updated_at   timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_applications_user_id ON applications(user_id);
CREATE INDEX idx_applications_status ON applications(user_id, status);

-- documents: a generated resume or cover letter for one application
CREATE TABLE documents (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  application_id uuid NOT NULL REFERENCES applications(id) ON DELETE CASCADE,
  kind           text NOT NULL,                  -- 'cover_letter' | 'resume'
  file_path      text NOT NULL,                  -- storage location, see note below
  jd_snapshot    text,                            -- JD text at generation time
  generated_at   timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_documents_application_id ON documents(application_id);

-- call_logs: written by either client (web quick-log or Android recording pipeline)
CREATE TABLE call_logs (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  application_id    uuid NOT NULL REFERENCES applications(id) ON DELETE CASCADE,
  transcript_text   text,
  extracted_facts   jsonb,                        -- {salary, contact_name, next_step, follow_up_date}
  recording_deleted boolean NOT NULL DEFAULT true, -- true immediately for the web quick-log
  source            text NOT NULL,                 -- 'web_manual' | 'android_recording'
  created_at        timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_call_logs_application_id ON call_logs(application_id);

-- reminders
CREATE TABLE reminders (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  application_id uuid NOT NULL REFERENCES applications(id) ON DELETE CASCADE,
  due_date       date NOT NULL,
  type           text NOT NULL,                   -- 'follow_up' | 'interview_prep' | 'offer_deadline'
  status         text NOT NULL DEFAULT 'pending',  -- pending|sent|dismissed|snoozed
  created_at     timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_reminders_due ON reminders(due_date, status);

-- subscriptions: billing state, one active row per user
CREATE TABLE subscriptions (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id          uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  tier             text NOT NULL DEFAULT 'free',   -- 'free' | 'pro'
  billing_cycle    text,                            -- 'monthly' | 'annual'
  payment_provider text,                            -- 'razorpay' | 'stripe'
  renewal_date     date,
  created_at       timestamptz NOT NULL DEFAULT now(),
  updated_at       timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX idx_subscriptions_user_id ON subscriptions(user_id);

-- payments: see docs/PAYMENTS.md for the full internal payment model
CREATE TABLE payments (
  id                 uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id            uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  provider           text NOT NULL,                 -- 'razorpay' | 'stripe'
  provider_payment_id text,
  provider_order_id  text,
  amount             integer NOT NULL,               -- smallest currency unit (paise/cents)
  currency           text NOT NULL,
  status             text NOT NULL,                  -- 'created'|'succeeded'|'failed'|'refunded'
  created_at         timestamptz NOT NULL DEFAULT now(),
  updated_at         timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_payments_user_id ON payments(user_id);
CREATE UNIQUE INDEX idx_payments_provider_payment_id
  ON payments(provider, provider_payment_id) WHERE provider_payment_id IS NOT NULL;

-- generation_usage: enforces the free-tier monthly limit server-side
CREATE TABLE generation_usage (
  user_id     uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  month       date NOT NULL,                        -- first-of-month marker
  count       integer NOT NULL DEFAULT 0,
  PRIMARY KEY (user_id, month)
);
```

**Note on `documents.file_path`:** the product spec assumed Supabase
Storage for resume/cover-letter PDFs. Since Supabase is out of scope
(Decision 2), pick a concrete file storage approach before Phase 2 —
options include Railway's volume storage or an S3-compatible bucket —
and record the decision here. Treat this as an open item, not a silent
default.

## Row-level ownership

Postgres on Railway does not give you Supabase's row-level security
policies for free. Ownership checks (`WHERE user_id = $currentUser`)
must be enforced explicitly in the repository/service layer on every
query that touches user-scoped data — this is now application code's
responsibility, not the database's. Write a test for this per table
that holds user-owned data, not just for the ones that feel sensitive.

## Backup policy

A production application must have a backup strategy before it is
considered production-ready — do not assume "hosted on Railway" means
"backed up." Document, before Phase 3 ships:

- Backup frequency
- Retention period
- Restore procedure
- Who is authorized to restore
- How the restore procedure is tested

For the early prototype this can be a manual process (a scheduled
`pg_dump` pulled somewhere durable). It should become automated and
monitored before real user data accumulates — see the portfolio
project's own research-form data loss for what happens when this step
is skipped.

CREATE TYPE application_status AS ENUM
  ('saved','applied','assessment','interview','offer','rejected');
CREATE TYPE application_source AS ENUM
  ('linkedin','naukri','indeed','referral','company_site','other');

CREATE TABLE applications (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id           UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,

  company           TEXT NOT NULL,
  role              TEXT NOT NULL,
  status            application_status NOT NULL DEFAULT 'saved',

  job_description   TEXT CHECK (char_length(job_description) <= 15000),
  source            application_source,
  source_url        TEXT,

  date_applied      DATE,
  assessment_due_at TIMESTAMPTZ,
  interview_at      TIMESTAMPTZ,
  notes             TEXT,

  last_activity_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  deleted_at        TIMESTAMPTZ,

  created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_applications_board
  ON applications (user_id, status, last_activity_at DESC)
  WHERE deleted_at IS NULL;

CREATE INDEX idx_applications_trash
  ON applications (user_id, deleted_at DESC)
  WHERE deleted_at IS NOT NULL;

CREATE TYPE salary_period AS ENUM ('monthly', 'annual');
CREATE TYPE location_pref AS ENUM ('remote', 'hybrid', 'onsite');
CREATE TYPE profile_source AS ENUM ('manual', 'resume_upload', 'sso_prefill');

CREATE TABLE profiles (
  user_id             UUID PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  full_name           TEXT NOT NULL,
  "current_role"      TEXT,
  target_role         TEXT,
  contact_email       CITEXT,
  years_experience    SMALLINT CHECK (years_experience  BETWEEN 0 AND 60),
  months_experience   SMALLINT CHECK (months_experience BETWEEN 0 AND 11),
  skills              TEXT[] NOT NULL DEFAULT '{}',
  salary_amount       NUMERIC(12,2),
  salary_currency     CHAR(3),
  salary_period       salary_period,
  location_preference location_pref,
  source              profile_source NOT NULL DEFAULT 'manual',
  completed_at        TIMESTAMPTZ,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT now(),

  CONSTRAINT salary_complete CHECK (
    (salary_amount IS NULL AND salary_currency IS NULL AND salary_period IS NULL)
    OR
    (salary_amount IS NOT NULL AND salary_currency IS NOT NULL AND salary_period IS NOT NULL)
  )
);

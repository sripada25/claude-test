CREATE TYPE document_type AS ENUM ('cover_letter','resume');

CREATE TABLE documents (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  application_id UUID NOT NULL REFERENCES applications(id) ON DELETE CASCADE,
  user_id        UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  type           document_type NOT NULL,
  content        TEXT NOT NULL,
  jd_snapshot    TEXT,
  provider       TEXT NOT NULL,
  model          TEXT NOT NULL,
  r2_key         TEXT,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_documents_application ON documents(application_id, created_at DESC);

CREATE TYPE job_status AS ENUM ('queued','running','succeeded','failed');

CREATE TABLE generation_jobs (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id        UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  application_id UUID NOT NULL REFERENCES applications(id) ON DELETE CASCADE,
  type           document_type NOT NULL,
  status         job_status NOT NULL DEFAULT 'queued',
  attempts       SMALLINT NOT NULL DEFAULT 0,
  error_class    TEXT,
  prompt_inputs  JSONB NOT NULL,
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
  operation     TEXT NOT NULL,
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

CREATE TABLE auth_attempts (
  id         BIGSERIAL PRIMARY KEY,
  identifier TEXT NOT NULL,
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

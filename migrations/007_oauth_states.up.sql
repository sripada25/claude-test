CREATE TABLE oauth_states (
  state_hash    TEXT PRIMARY KEY,
  provider      oauth_provider NOT NULL,
  code_verifier TEXT NOT NULL,
  redirect_path TEXT,
  user_id       UUID REFERENCES users(id) ON DELETE CASCADE,
  expires_at    TIMESTAMPTZ NOT NULL,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_oauth_states_expiry ON oauth_states(expires_at);

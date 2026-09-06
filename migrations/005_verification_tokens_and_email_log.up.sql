CREATE TYPE token_purpose AS ENUM ('verify_email', 'change_email', 'password_reset');

CREATE TABLE verification_tokens (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token_hash TEXT NOT NULL,
  purpose    token_purpose NOT NULL,
  new_email  CITEXT,
  attempts   SMALLINT NOT NULL DEFAULT 0,
  expires_at TIMESTAMPTZ NOT NULL,
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

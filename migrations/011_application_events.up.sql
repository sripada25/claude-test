CREATE TYPE event_type AS ENUM
  ('created','status_changed','document_generated','call_logged',
   'follow_up_sent','reminder_set','note_updated');

CREATE TABLE application_events (
  id             BIGSERIAL PRIMARY KEY,
  application_id UUID NOT NULL REFERENCES applications(id) ON DELETE CASCADE,
  user_id        UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  type           event_type NOT NULL,
  description    TEXT NOT NULL,
  metadata       JSONB NOT NULL DEFAULT '{}',
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_events_application ON application_events(application_id, created_at DESC);

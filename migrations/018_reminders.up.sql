CREATE TYPE reminder_type   AS ENUM ('application_followup','post_interview');
CREATE TYPE reminder_status AS ENUM ('pending','snoozed','sent','dismissed');

CREATE TABLE reminders (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id        UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  application_id UUID NOT NULL REFERENCES applications(id) ON DELETE CASCADE,
  type           reminder_type   NOT NULL,
  status         reminder_status NOT NULL DEFAULT 'pending',
  due_at         TIMESTAMPTZ NOT NULL,
  snoozed_until  TIMESTAMPTZ,
  draft_content  TEXT,
  sent_at        TIMESTAMPTZ,
  dismissed_at   TIMESTAMPTZ,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT now(),

  UNIQUE (application_id, type)
);

CREATE INDEX idx_reminders_queue ON reminders (user_id, due_at)
  WHERE status IN ('pending','snoozed');

ALTER TABLE applications
  ADD COLUMN follow_up_snoozed_until TIMESTAMPTZ;

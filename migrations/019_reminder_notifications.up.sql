ALTER TABLE users
  ADD COLUMN reminder_emails_enabled BOOLEAN NOT NULL DEFAULT true;

ALTER TABLE reminders
  ADD COLUMN notified_at TIMESTAMPTZ;

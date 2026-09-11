ALTER TABLE reminders
  DROP COLUMN notified_at;

ALTER TABLE users
  DROP COLUMN reminder_emails_enabled;

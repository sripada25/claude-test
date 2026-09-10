ALTER TABLE applications
  DROP COLUMN follow_up_snoozed_until;

DROP TABLE reminders;
DROP TYPE reminder_status;
DROP TYPE reminder_type;

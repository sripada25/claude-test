DROP INDEX idx_applications_manual_sort;

ALTER TABLE applications
  DROP COLUMN position;

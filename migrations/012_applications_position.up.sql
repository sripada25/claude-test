ALTER TABLE applications
  ADD COLUMN position DOUBLE PRECISION;

CREATE INDEX idx_applications_manual_sort
  ON applications (user_id, status, position)
  WHERE deleted_at IS NULL;

CREATE TABLE employment_history (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  employer    TEXT NOT NULL,
  title       TEXT NOT NULL,
  start_date  DATE NOT NULL,
  end_date    DATE,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now(),

  CONSTRAINT employment_dates_ordered CHECK (end_date IS NULL OR end_date >= start_date)
);

CREATE INDEX idx_employment_history_user ON employment_history(user_id, start_date DESC);

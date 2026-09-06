CREATE TYPE subscription_tier AS ENUM ('free', 'pro');
CREATE TYPE subscription_status AS ENUM ('trialing', 'active', 'past_due', 'cancelled');

CREATE TABLE subscriptions (
  user_id                   UUID PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  tier                      subscription_tier   NOT NULL DEFAULT 'free',
  status                    subscription_status NOT NULL DEFAULT 'trialing',
  trial_ends_at             TIMESTAMPTZ,
  trial_generations_limit   SMALLINT NOT NULL DEFAULT 40,
  trial_generations_used    SMALLINT NOT NULL DEFAULT 0,
  current_period_end        TIMESTAMPTZ,
  provider                  TEXT,
  provider_subscription_id  TEXT,
  created_at                TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at                TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE generation_quota (
  user_id      UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  period_start DATE NOT NULL,
  used         INT  NOT NULL DEFAULT 0,
  PRIMARY KEY (user_id, period_start)
);

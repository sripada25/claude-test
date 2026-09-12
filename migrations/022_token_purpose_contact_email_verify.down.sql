ALTER TYPE token_purpose RENAME TO token_purpose_old;

CREATE TYPE token_purpose AS ENUM ('verify_email', 'change_email', 'password_reset');

ALTER TABLE verification_tokens
  ALTER COLUMN purpose TYPE token_purpose USING purpose::text::token_purpose;

DROP TYPE token_purpose_old;

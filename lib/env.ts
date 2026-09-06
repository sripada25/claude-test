function required(name: string): string {
  const value = process.env[name];
  if (!value || value.trim() === "") {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

function requiredPort(name: string): number {
  const value = required(name);
  const port = Number(value);
  if (!Number.isInteger(port) || port <= 0) {
    throw new Error(`Environment variable ${name} must be a positive integer, got: ${value}`);
  }
  return port;
}

// Each field validates lazily, on access - not all at module-import time.
// Code that only needs DATABASE_URL (e.g. the migration runner) must not be
// forced to also have SMTP_* configured just because this module now knows
// about more variables than it used to.
export const env = {
  get DATABASE_URL(): string {
    return required("DATABASE_URL");
  },
  get SMTP_HOST(): string {
    return required("SMTP_HOST");
  },
  get SMTP_PORT(): number {
    return requiredPort("SMTP_PORT");
  },
  get EMAIL_FROM(): string {
    return required("EMAIL_FROM");
  },
};

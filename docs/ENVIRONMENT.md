# Environment Variables

## Rule

Never commit an actual secret value. `.env` and `.env.*` are gitignored
everywhere except `.env.example`, which holds placeholder names only —
see the `.gitignore` block below. An AI coding agent must never ask a
human to paste a production secret into chat; use the Railway
dashboard's variable settings or a local `.env` file instead.

## `backend/.env.example`

```bash
# Database (Railway Postgres — see docs/DATABASE.md)
DATABASE_URL=

# Sessions (docs/AUTHENTICATION.md)
SESSION_SECRET=

# Google OIDC (docs/AUTHENTICATION.md)
GOOGLE_CLIENT_ID=
GOOGLE_CLIENT_SECRET=
GOOGLE_REDIRECT_URI=

# AI generation
GEMINI_API_KEY=

# Payments — India (docs/PAYMENTS.md)
RAZORPAY_KEY_ID=
RAZORPAY_KEY_SECRET=

# Payments — international (docs/PAYMENTS.md)
STRIPE_SECRET_KEY=
STRIPE_WEBHOOK_SECRET=

# Email provider (password reset, verification)
EMAIL_PROVIDER_API_KEY=
EMAIL_FROM_ADDRESS=

# Environment marker
NODE_ENV=development
PORT=3000
```

## `frontend/.env.example`

```bash
# Base URL of the backend API for this environment
VITE_API_BASE_URL=http://localhost:3000

# Public Google OAuth client ID (safe to expose — the secret stays backend-only)
VITE_GOOGLE_CLIENT_ID=
```

Only variables prefixed `VITE_` are exposed to frontend code by Vite's
build — this is a deliberate boundary. Never put a value on the
frontend side that isn't safe for any website visitor to read in their
browser's dev tools.

## `.gitignore` (relevant excerpt)

```gitignore
.env
.env.*
!.env.example
```

## Where each secret comes from

| Variable | Source |
|---|---|
| `DATABASE_URL` | Railway Postgres service → Connect tab |
| `SESSION_SECRET` | Generate locally: `openssl rand -base64 32` — different value per environment |
| `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` | Google Cloud Console → OAuth 2.0 credentials, one set per environment (local/staging/production each need their own redirect URI registered) |
| `GEMINI_API_KEY` | Google AI Studio |
| `RAZORPAY_KEY_ID` / `RAZORPAY_KEY_SECRET` | Razorpay dashboard — use **test mode** keys outside production |
| `STRIPE_SECRET_KEY` / `STRIPE_WEBHOOK_SECRET` | Stripe dashboard — use **test mode** keys outside production |

## Isolation rule

`production DATABASE_URL`, `staging DATABASE_URL`, and `local
DATABASE_URL` are three different values, set in three different
places (Railway's per-environment variable scoping, or a local `.env`
file). Never point local development tooling at the production
database. Never run a destructive database command against production
without a separate, explicit confirmation step outside of normal
development flow.

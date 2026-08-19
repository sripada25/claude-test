# Deployment

## Compatible library choices

Picked to avoid version conflicts across the stack — TypeScript
end-to-end, one validation library shared by frontend and backend, one
test runner shared where possible. Install the current stable release of
each; pin via the committed lock file rather than exact versions in this
doc, since npm registry versions move faster than documentation should
try to track.

| Purpose | Choice | Notes |
|---|---|---|
| Frontend build | Vite | Standard modern React+TS scaffold |
| Frontend framework | React | |
| Language | TypeScript | Strict mode, both frontend and backend |
| Styling | Tailwind CSS | No component libraries — see README.md |
| Routing (frontend) | React Router | |
| Server state (frontend) | TanStack Query | Optional but recommended once the API has more than a couple of endpoints — avoids hand-rolled fetch/loading/error state everywhere |
| Backend framework | Express | Matches the routes/controllers/services layering in AGENTS.md §4 |
| Postgres driver | `pg` (node-postgres) | |
| Schema / migrations | Drizzle ORM + Drizzle Kit | See `docs/DATABASE.md` |
| Validation | Zod | Same library on both sides of the API boundary |
| Password hashing | `argon2` | Wraps the reference Argon2id implementation — see `docs/AUTHENTICATION.md` |
| OIDC client | `openid-client` | Spec-compliant OIDC, not a loose OAuth wrapper |
| Sessions | `express-session` + `connect-pg-simple` | Postgres-backed store, no new infra dependency |
| Payments | `razorpay`, `stripe` | Official SDKs, both behind the `PaymentProvider` interface |
| Logging | `pino` | Structured JSON, redaction support |
| Unit/integration tests | Vitest | Works cleanly with the Vite-based frontend and a TS backend |
| E2E tests | Playwright | Named explicitly in the original planning doc |
| Linting | ESLint + `typescript-eslint` | |
| Formatting | Prettier | |

Do not add a dependency not in this table without updating this table
and explaining why — see AGENTS.md §3.

## Environments

At minimum: `local`, `staging`, `production`. For the initial prototype,
direct production deployment without a staging step may be temporarily
acceptable, but the repository and configuration must still be built to
support staging — do not hardcode anything that assumes only one
non-local environment exists.

Never mix credentials across environments. `DATABASE_URL`,
`GOOGLE_CLIENT_SECRET`, `RAZORPAY_KEY_SECRET`, etc. are all
environment-specific — see `docs/ENVIRONMENT.md`.

## Domain strategy

```
Phase 1 — local:              http://localhost:<port>
Phase 2 — Railway-generated:  https://<project>.up.railway.app
Phase 3 — custom domain:      https://www.example.com / https://api.example.com
```

No public HTTPS requirement exists during ordinary local development —
`http://localhost` is fine, and OAuth providers can be configured with
localhost redirect URIs where their policy permits it. Production must
use HTTPS. Railway automatically provisions SSL certificates for public
HTTP services and for correctly configured custom domains — you do not
need to buy or manually configure a certificate.

## Railway setup

Three services in one Railway project:

- `frontend` — static build output
- `backend` — Node.js API
- Postgres — Railway's managed Postgres service

Use Railway's private networking between `backend` and Postgres rather
than routing that traffic over the public internet. Isolate environment
variables per Railway environment (`production DATABASE_URL`, `staging
DATABASE_URL`, `local DATABASE_URL` are three different values) — do not
accidentally point local development at the production database, and do
not run a destructive database command against production without an
explicit, separate confirmation step.

## API conventions

```
POST   /api/v1/auth/register
POST   /api/v1/auth/login
POST   /api/v1/auth/logout
POST   /api/v1/auth/forgot-password
POST   /api/v1/auth/reset-password

GET    /api/v1/users/me

POST   /api/v1/applications
GET    /api/v1/applications
PATCH  /api/v1/applications/:id

POST   /api/v1/applications/:id/documents
POST   /api/v1/applications/:id/call-logs

POST   /api/v1/payments/orders
POST   /api/v1/payments/webhooks/razorpay
POST   /api/v1/payments/webhooks/stripe
```

Exact endpoint design can evolve, but the versioned, resource-based
naming convention (`/api/v1/<resource>`) stays consistent. Version the
API if a future breaking change requires it.

## CI pipeline

GitHub Actions. A pull request must fail if any of these fail — it must
not be approved solely because "the app looks like it works."

```yaml
name: CI

on:
  pull_request:
  push:
    branches: [main]

jobs:
  ci:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - uses: actions/setup-node@v4
        with:
          node-version: 20
          cache: npm

      - name: Install (backend)
        working-directory: backend
        run: npm ci

      - name: Install (frontend)
        working-directory: frontend
        run: npm ci

      - name: Typecheck (backend)
        working-directory: backend
        run: npm run typecheck

      - name: Typecheck (frontend)
        working-directory: frontend
        run: npm run typecheck

      - name: Lint
        run: |
          npm run lint --workspace=backend
          npm run lint --workspace=frontend

      - name: Unit tests
        working-directory: backend
        run: npm run test:unit

      - name: Integration tests
        working-directory: backend
        run: npm run test:integration
        env:
          DATABASE_URL: ${{ secrets.CI_DATABASE_URL }}

      - name: Build frontend
        working-directory: frontend
        run: npm run build

      - name: Build backend
        working-directory: backend
        run: npm run build

      - name: Dependency audit
        run: |
          npm audit --workspace=backend --audit-level=high
          npm audit --workspace=frontend --audit-level=high

      - name: Secret scan
        uses: gitleaks/gitleaks-action@v2
```

Recommended additions once the team has bandwidth: a dependency
vulnerability scanning action, SAST (e.g. CodeQL), and Anthropic's
`/security-review` or the equivalent GitHub Action for AI-assisted PR
review — treated as an additional layer per `docs/SECURITY.md`, not the
only control. Keep any such workflow's permissions minimal and do not
expose secrets to it unnecessarily.

## Deployment workflow

```
LOCAL DEVELOPMENT
    |
    v
FEATURE BRANCH
    |
    v
LOCAL VALIDATION
    |
    v
PUSH TO GITHUB
    |
    v
CI VALIDATION
    |
    v
CODE REVIEW
    |
    v
SECURITY REVIEW
    |
    v
HUMAN APPROVAL
    |
    v
STAGING
    |
    v
SMOKE TEST
    |
    v
PRODUCTION APPROVAL
    |
    v
PRODUCTION
```

## Git branching

```
main
develop
feature/*
fix/*
security/*
```

Do not develop directly on `main` unless explicitly approved. A feature
branch represents one meaningful change: `feature/user-registration`,
`feature/google-login`, `feature/payment-order`,
`fix/password-reset-rate-limit`, `security/session-cookie-hardening`.

## Pull request requirements

Every PR must state: what changed, why it changed, files/components
touched, database changes, API changes, security implications, tests
added/updated, known limitations, manual test steps, and rollback
considerations.

## Production readiness gate

The application is not production-ready simply because it works.
Before production:

- [ ] Build passes
- [ ] Tests pass
- [ ] Security review passes (`docs/SECURITY.md` checklist)
- [ ] Dependency audit passes
- [ ] Secrets are externalized (none in source)
- [ ] HTTPS works
- [ ] OAuth redirect URIs work for the production domain
- [ ] Authentication and authorization work end to end
- [ ] Payment verification and webhook handling work
- [ ] Database backup strategy exists (`docs/DATABASE.md`)
- [ ] Logging and monitoring exist
- [ ] Error handling is safe (no internal detail leaked)
- [ ] Rate limits exist
- [ ] CORS is restricted to known origins
- [ ] Production environment variables are correct and environment-scoped
- [ ] A rollback procedure exists

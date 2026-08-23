# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Repository status

**Pre-implementation.** This repository currently contains only planning
documents (`docs/`, `AGENTS.md`, `README.md`) and an untracked reference
PDF (`trackr/Trackr-Product-Documentation.pdf`). No `frontend/` or
`backend/` directory, no `package.json`, and no application code exist
yet. There is nothing to build, lint, or test until that scaffolding is
created — do not assume commands like `npm run dev` work until you have
verified the relevant `package.json` exists.

When scaffolding the project for the first time, follow the stack and
structure documented below rather than improvising a different one, and
update this file with the real commands (`npm run dev`, `npm run
typecheck`, `npm run lint`, `npm run test:unit`, single-test invocation,
etc.) once `package.json` scripts exist.

## Read the docs before writing code

This repo governs itself through documentation, and the docs take
priority over convenience, speed, or assumptions. Read in this order
before making a change:

1. **[AGENTS.md](AGENTS.md)** — the actual governing rules (below is a
   condensed summary; AGENTS.md is authoritative on conflicts)
2. [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) — system shape, data model, generation pipeline
3. [docs/AUTHENTICATION.md](docs/AUTHENTICATION.md) — login/session design
4. [docs/DATABASE.md](docs/DATABASE.md) — proposed schema and migration rules
5. [docs/PAYMENTS.md](docs/PAYMENTS.md) — Razorpay/Stripe integration rules
6. [docs/SECURITY.md](docs/SECURITY.md) — OWASP baseline and pre-deploy checklist
7. [docs/DEPLOYMENT.md](docs/DEPLOYMENT.md) — Railway, CI pipeline, environments, git branching
8. [docs/ENVIRONMENT.md](docs/ENVIRONMENT.md) — every environment variable and where it comes from

## What this project is

Trackr is a job-search companion: tracks applications, generates
tailored cover letters/resumes via AI, and turns recruiter calls into
structured follow-up actions. **This repository is the web app only.**
A separate Android-first Expo mobile app (not in this repo) owns
call-recording and shares the same backend API and Postgres database.
Do not add React Native/Expo tooling or call-recording code here.

## Three decisions that override the original planning PDFs

The original product/agent-instructions PDFs assumed React Native +
Expo (single codebase), Supabase, and Vercel. These were superseded on
2026-08-19 (see [AGENTS.md](AGENTS.md) §0):

1. **Two codebases, not one** — this repo is web-only; the mobile app is separate.
2. **Railway + Postgres + custom auth, not Supabase** — the team owns the
   OAuth/session/password security surface directly; see
   [docs/AUTHENTICATION.md](docs/AUTHENTICATION.md).
3. **No third-party UI component libraries** — every component (buttons,
   modals, forms, dropdowns, tables, toasts) is hand-built with React +
   TypeScript + Tailwind + semantic HTML5. This bans shadcn/ui, MUI,
   Chakra, Ant Design, Radix, Headless UI, Bootstrap — including
   anything marketed as "headless" that still ships pre-built component
   behavior/markup.

If a PDF in `trackr/` or elsewhere disagrees with `AGENTS.md` or `docs/`,
the docs win — the PDFs are historical planning artifacts only.

## Intended architecture (once scaffolded)

```
Browser (web)              Expo app (Android, iOS later — separate repo)
    |                              |
    | HTTPS / JSON                | HTTPS / JSON
    v                              v
        Node.js + TypeScript backend (Express)
                    |
    +---------------+----------------+
    |                                |
    v                                v
PostgreSQL (Railway)          External services
                               - Google OIDC
                               - Gemini Flash (AI generation)
                               - Razorpay / Stripe
                               - Email provider
```

One backend, one database, two clients (web + mobile), never talking to
each other directly — everything goes through the REST API.

**Frontend** (`frontend/`): React + TypeScript (strict, no implicit
`any`) + Tailwind, built with Vite. React Router for routing, TanStack
Query recommended for server state once the API has more than a couple
of endpoints. The frontend is never a trusted security boundary — every
check it does (roles, validation, pricing) is UX convenience only; the
backend re-validates everything independently.

**Backend** (`backend/`): Node.js + TypeScript, Express, layered as
`routes → controllers → services → repositories`, with centralized auth
middleware, Zod schema validation, error handling, and structured
logging (`pino`). Don't put payment logic in route handlers, don't
scatter DB queries across controllers, don't duplicate authorization
logic outside middleware. Expected internal layout (see AGENTS.md §4):

```
backend/src/
  config/  routes/  controllers/  services/  repositories/
  middleware/  validators/  auth/
  integrations/{google,razorpay,stripe}/
  database/  utils/  errors/  app.ts  server.ts
backend/tests/
```

**Auth and payments are provider-abstracted** — application code depends
on an internal `AuthProvider` / `PaymentProvider` interface, never on
Razorpay/Stripe/Google-specific field names outside their own provider
implementation. This is what lets LinkedIn/Indeed/Naukri auth or new
payment providers be added later without a redesign — and lets
unsupported providers (Indeed, Naukri — both **OPEN DECISION**, do not
build) stay cleanly disabled.

**Data model**: `applications` is the primary object everything connects
to. A user has one or more `auth_identities` (local password / Google),
linked explicitly and never auto-merged on matching email. `call_logs`
is written by either client (web's 3-question manual quick-log, or the
mobile app's recording pipeline) into the same table via the same API
endpoint. Full proposed DDL is in
[docs/DATABASE.md](docs/DATABASE.md) — **no tables exist yet**; that doc
is a proposal to review, not a fait accompli.

## Planned tech choices (do not substitute without updating docs/DEPLOYMENT.md)

| Purpose | Choice |
|---|---|
| DB driver / migrations | `pg` + Drizzle ORM & Drizzle Kit (or `node-pg-migrate` as the hand-SQL alternative — pick one, don't mix) |
| Validation | Zod (shared shape between frontend and backend) |
| Password hashing | `argon2` (Argon2id) — never hand-write hashing |
| OIDC | `openid-client` |
| Sessions | `express-session` + `connect-pg-simple` (Postgres-backed; sessions, not JWTs) |
| Payments | `razorpay`, `stripe` SDKs behind `PaymentProvider` |
| Logging | `pino` with redaction |
| Unit/integration tests | Vitest |
| E2E tests | Playwright |
| Lint/format | ESLint + `typescript-eslint`, Prettier |

## Non-negotiable engineering rules

- **Never guess business requirements.** Pricing, refunds, admin
  privileges, data-retention, which OAuth providers are actually
  available, notification policy — if it's not in `docs/`, mark it
  `ASSUMPTION:`, `OPEN DECISION:`, or `BLOCKED:` in the code/PR rather
  than inventing and silently encoding behavior.
- **Never mark a payment successful based on frontend/client state.**
  The backend verifies via the provider's signature mechanism and its
  own records only. Webhooks must be idempotent (key on
  `provider_payment_id`).
- **Every user-scoped query is ownership-scoped in application code**
  (`WHERE user_id = $currentUser`) — Railway Postgres has no
  Supabase-style row-level security, so this is not automatic.
- **Sessions, not JWTs.** `HttpOnly` / `Secure` / `SameSite` cookies,
  Postgres-backed session store.
- Without explicit human approval, do not: deploy to production, merge
  to `main` without review, rotate/expose credentials, run destructive
  migrations, rewrite documented architecture, add a new external
  dependency without justifying it in `docs/DEPLOYMENT.md`'s table, or
  weaken password/session requirements.
- Follow the change lifecycle in AGENTS.md §1: understand → inspect →
  identify architecture/dependencies → state assumptions → propose
  approach → implement only the approved scope → test → security-check
  → report → stop for human review when the change warrants it. "Build
  feature X" is not license to redesign unrelated parts of the system.

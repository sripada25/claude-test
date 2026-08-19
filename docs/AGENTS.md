# Agent Instructions — Trackr Web App

Governing instruction set for any AI coding agent working in this
repository — Claude Code, Cursor, or otherwise. This file condenses the
project's original 39-page "AI Agent Instructions" planning document
down to what applies to *this* repo (the web app), and records three
decisions that were made explicitly after that document and the product
spec were found to disagree with each other and with the current stack
choice. Read this file before making any architectural change.

## 0. Three decisions that override the planning PDFs

The original Product Documentation and AI Agent Instructions PDFs (kept
in `Project-Docs/` for history) specify React Native + Expo, Supabase,
and Vercel. Those were superseded on **19 August 2026** by direct
instruction. Do not silently follow the PDFs over this file.

**Decision 1 — Two codebases, not one.**
The product is web (this repo) *and* an Android-first Expo mobile app,
built simultaneously, sharing one backend API and one database. This
repo is web-only. Do not add React Native, Expo, or any mobile
tooling here. Do not add call-recording code here — that is a mobile-app
feature and has no web equivalent.

**Decision 2 — Railway + Postgres + custom auth, not Supabase.**
The PDFs preferred Supabase because its free tier bundles auth, Postgres,
and file storage into a near-zero launch cost, and its client library
happens to work identically on web and Expo. Neither reason is an Android
requirement — Android call recording is a device permission, unrelated to
the backend. The project is standardising on Railway Postgres with a
custom-built auth layer instead. This is a real tradeoff, not a free
upgrade: the team now owns the OAuth/session/password code and its
security surface directly, where Supabase would have provided it.
`docs/AUTHENTICATION.md` exists specifically to make sure that surface is
built correctly rather than improvised. Do not reintroduce Supabase.

**Decision 3 — No third-party UI component libraries.**
Every component is built from scratch with React, TypeScript, Tailwind
CSS, and semantic HTML5. This is stricter than the PDFs' general
"reusable components" guidance. See README.md for the full rule and
what counts as a violation.

## 1. Core operating principle

Do not attempt to build large features in one pass. Every meaningful
change follows this lifecycle:

1. Understand the requested feature
2. Inspect the existing repository and related docs
3. Identify relevant architecture and dependencies
4. State assumptions explicitly
5. Propose the implementation approach
6. Implement only the approved scope
7. Run automated tests and static checks
8. Run security checks relevant to the change
9. Produce a human-readable validation report
10. **Stop and wait for human approval when the change requires human review**
11. Only after approval, make the next controlled change
12. Never silently expand scope

"Build feature X" is not permission to redesign unrelated parts of the
system.

## 2. Never guess product requirements

If a business requirement is not defined in `docs/`, do not invent
business behaviour and encode it permanently. Examples of things that
must not be guessed: pricing changes, refund rules, admin privileges,
data-retention periods, which OAuth/SSO providers beyond Google are
actually available, notification policy.

Use these markers rather than hiding uncertainty inside code:

```
ASSUMPTION: ...
OPEN DECISION: ...
BLOCKED: required information is missing
```

## 3. What the agent must not do without explicit human approval

- Deploy to production
- Merge changes to `main`/production without review
- Rotate or expose credentials
- Delete production data or run destructive migrations
- Rewrite the architecture described in `docs/`
- Introduce a new external service or dependency without explaining why
- Disable a security control to make a test pass
- Force-push a protected branch
- Weaken password or session security requirements

## 4. Repository structure

```
Trackr/
  frontend/          React + TypeScript + Tailwind (Vite)
  backend/            Node.js + TypeScript (Express)
  docs/               ARCHITECTURE, AUTHENTICATION, DATABASE, PAYMENTS,
                       SECURITY, DEPLOYMENT, ENVIRONMENT
  Project-Docs/       Original planning PDFs — history only, see §0
  .github/workflows/  CI
  .env.example
  README.md
  AGENTS.md           This file
```

Backend internal structure (mirrors the pattern in `docs/ARCHITECTURE.md`):

```
backend/src/
  config/
  routes/
  controllers/
  services/
  repositories/
  middleware/
  validators/
  auth/
  integrations/
    google/
    razorpay/
    stripe/
  database/
  utils/
  errors/
  app.ts
  server.ts
backend/tests/
```

Do not place payment logic directly in route handlers. Do not scatter
database queries through arbitrary controllers. Do not duplicate
authorization logic across routes — it belongs in middleware.

## 5. Provider abstraction is mandatory

Auth providers and payment providers must sit behind an interface so an
unsupported or not-yet-available provider (Indeed, Naukri) can stay
disabled without redesigning the system:

```
AuthProvider
  ├── LocalProvider (email/password)
  ├── GoogleProvider
  ├── LinkedInProvider (later — not v1)
  └── IndeedProvider / NaukriProvider (OPEN DECISION — do not build
      until official OAuth/OIDC access is confirmed; see
      docs/AUTHENTICATION.md)

PaymentProvider
  ├── RazorpayProvider (v1 — India)
  └── StripeProvider (v1 — international, invite-only account model)
```

## 6. Required security baseline

OWASP Top 10:2025 and OWASP ASVS 5.0. Full checklist in
`docs/SECURITY.md` — run it before every deployment, not just once.

## 7. CI must pass before merge

Install → typecheck → lint → unit tests → integration tests → build
frontend → build backend → dependency audit → secret scan. Full workflow
in `docs/DEPLOYMENT.md`. A pull request must not be approved solely
because the application "looks like it works."

## 8. What "done" means

The agent should optimise for correctness, security, maintainability,
observability, and controlled change — not for maximum code produced,
minimum files touched, or fastest implementation. Prefer a small,
correct change over a large speculative one. When uncertain, say so, in
the `ASSUMPTION` / `OPEN DECISION` / `BLOCKED` format above. Never
conceal uncertainty just to keep development moving.

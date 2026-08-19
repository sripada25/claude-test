# Trackr — Web App

A job search companion that tracks applications, generates tailored cover
letters and resumes, and turns recruiter calls into structured follow-up
actions.

This repository is the **web app**. Trackr also ships an Android-first
mobile app (React Native + Expo, iOS later) that owns the call-recording
feature — see [Platform scope](#platform-scope) below for how the two
relate and why they are separate codebases sharing one backend.

## Before you write any code

Read these in order. They are the governing rules for this project —
higher priority than convenience, speed, or assumptions:

1. [AGENTS.md](AGENTS.md) — rules for any AI coding agent (Claude Code,
   Cursor) working in this repo, and the resolved decisions that
   supersede the original planning PDFs
2. [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) — system shape and data model
3. [docs/AUTHENTICATION.md](docs/AUTHENTICATION.md) — how login/sessions work
4. [docs/DATABASE.md](docs/DATABASE.md) — schema and migration rules
5. [docs/PAYMENTS.md](docs/PAYMENTS.md) — Razorpay/Stripe integration rules
6. [docs/SECURITY.md](docs/SECURITY.md) — OWASP baseline and checklist
7. [docs/DEPLOYMENT.md](docs/DEPLOYMENT.md) — Railway, CI, environments
8. [docs/ENVIRONMENT.md](docs/ENVIRONMENT.md) — every environment variable

## Platform scope

Trackr is one product, two codebases, one backend:

| | This repo | Mobile app |
|---|---|---|
| Stack | React + TypeScript + Tailwind CSS + HTML5 | React Native + Expo |
| Platform | Web browser | Android first, iOS later (same Expo build) |
| Owns | Tracker, AI generation, manual call log, payments, account settings | Everything the web app does, **plus** Android call recording |
| Backend | Same Node.js + TypeScript API, same Postgres database | Same |

**Why two codebases instead of one React Native app for everything:**
Android call recording needs native device APIs a browser cannot reach.
Everything else in the product — the tracker, AI generation, payments,
the follow-up system — has no such requirement, so it is built once as a
proper web app rather than forced through a mobile-app shell. Both
clients talk to the same REST API and the same database, so an
application logged from the phone shows up on the web tracker
immediately and vice versa.

This repository does not contain the mobile app. Its documentation
covers the web app and the shared backend API both clients depend on.

## Tech stack (this repo)

| Layer | Choice | Why |
|---|---|---|
| Frontend | React + TypeScript + Tailwind CSS, built with Vite | No component libraries — see rule below |
| Backend | Node.js + TypeScript, Express | REST API, matches the shared-backend requirement with the mobile app |
| Database | PostgreSQL, hosted on Railway | See [docs/DATABASE.md](docs/DATABASE.md) for why not Supabase |
| Hosting | Railway | Frontend, backend, and Postgres as separate Railway services |
| Auth | Custom — email/password + Google OIDC | See [docs/AUTHENTICATION.md](docs/AUTHENTICATION.md) |
| Payments | Razorpay (India), Stripe (international), behind one interface | See [docs/PAYMENTS.md](docs/PAYMENTS.md) |

## Hard rule: no third-party UI component libraries

Every UI component — buttons, modals, forms, dropdowns, tables, toasts —
is built from scratch with React, TypeScript, Tailwind CSS, and
semantic HTML5. This means no shadcn/ui generated components, no MUI, no
Chakra, no Ant Design, no Radix or Headless UI primitives, no Bootstrap.
Tailwind's own utility classes and native HTML elements are the entire
toolkit.

**Why:** stated as a hard requirement, not a style preference. Treat any
dependency that ships pre-built React components as violating this rule,
even if it markets itself as "unstyled" or "headless" — the point is
that the component's behaviour and markup are authored in this repo, not
imported.

## Local development

```bash
# Backend
cd backend && npm install && npm run dev

# Frontend
cd frontend && npm install && npm run dev
```

Both require `.env` files — copy `.env.example` in each directory and
fill in values. See [docs/ENVIRONMENT.md](docs/ENVIRONMENT.md) for what
each variable does and where to get it. **Never commit `.env`.**

## Status

Pre-implementation. These documents define the architecture; no
application code has been written yet. The database has no tables —
[docs/DATABASE.md](docs/DATABASE.md) proposes the schema for review
before the first migration is written.

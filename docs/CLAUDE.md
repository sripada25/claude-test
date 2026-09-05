# CLAUDE.md — Trackr

Read this first, every session. It is the permanent rule set.
Feature detail lives in the linked documents — do not duplicate it here.

---

## 1 · WHAT THIS IS

**Trackr** — a job application tracker. Users log applications, generate tailored cover letters and resumes from a job description plus their profile, and capture what happened on recruiter calls.

Currently specified for implementation: **F1 User Accounts, F2 Application Tracker, F3 AI Generation, F4 Follow-up System.** F5 and F6 are not started. See `PRODUCT-REFERENCE_quarterfinal.md` §3 for the current status of each.

## 2 · DOCUMENT MAP

⚠️ **Files suffixed `_quarterfinal` are current. Files without that suffix are historical/superseded** — kept in the repo for decision history, never for current specs. If a `_quarterfinal` version exists, use it. Do not read the non-suffixed version for schema, security, or task content.

| File | Contains | When to read |
|---|---|---|
| `CLAUDE.md` | This file — permanent rules | Always |
| `PRODUCT-REFERENCE_quarterfinal.md` | The master chain — PRD → feature → task → ledger → schema → screen. **Read this first for orientation**, then go to the specific document it points to | Starting any new area of work |
| `DECISIONS_quarterfinal.md` | Every decision, why, and what would reopen it — current, merges the two historical ledgers below | Before any design choice |
| `DECISIONS.md` · `DECISIONS-MOCKUP-REVIEW.md` | ⚠️ Historical only — reasoning detail for L001–L112, referenced not duplicated by the quarterfinal ledger | Only if the quarterfinal record points you here for full reasoning |
| `SECURITY_quarterfinal.md` | Complete OWASP 2025 threat model + resolved controls, local vs production, deploy checklist, required tests | Any auth/data task, and before deploy |
| `SECURITY.md` · `SECURITY-CONTROLS.md` | ⚠️ Historical — merged into `SECURITY_quarterfinal.md` | Not for current use |
| `DATABASE_quarterfinal.md` | Schema, constraints, indexes, migrations — includes F4's tables | Any DB task |
| `DATABASE.md` | ⚠️ Historical — missing F4 tables, superseded | Not for current use |
| `DATABASE-SECURITY.md` | Table-level access rules | Any DB task |
| `BACKEND.md` | Layering, module boundaries, conventions | Any API/service task |
| `FRONTEND.md` | Component and state conventions | Any UI task |
| `TESTING.md` | What to test and how | Every task |
| `PLATFORM.md` | Docker, env vars, local vs production | Setup and deploy |
| `GIT.md` | Branch, commit, PR conventions | Every task |
| `TASKS_quarterfinal.md` | Backend tasks — F0, F1, F2, F4, P9. IDs, dependencies, env markers | Picking up backend work |
| `TASKS-FRONTEND_quarterfinal.md` | Frontend tasks — every screen, self-contained, pen-verified values | Picking up frontend work |
| `TASKS.md` · `TASKS-2026-08-26-v2.md` · `TASKS-BY-LAYER.md` | ⚠️ Historical — superseded by the two `_quarterfinal` task files above | Not for current use |
| `ISSUES.md` | Issue-before-branch workflow, frozen-contract rule | Before starting any task |
| `TASK-REFERENCE.md` | Task specification template | Writing a task |
| `CODECONDUCT.md` | Code style and structure | Always |
| `REPORTS.md` | Completion report template | Finishing a task |

**Do not read all of these for every task.** Read this file, `TASKS_quarterfinal.md` or `TASKS-FRONTEND_quarterfinal.md` for your task, and the two or three `_quarterfinal` documents it names.

## 3 · STACK — LOCKED

Do not substitute, add frameworks, or "modernise" any of these without escalating.

```
Next.js 16 (App Router) · Node 24 LTS · TypeScript
React 19 · Tailwind CSS 4 — NO component library (no shadcn, MUI, Chakra)
PostgreSQL — standard PG only, no vendor extensions
Docker — one app container, one Postgres container
```

**Next.js *is* the Node application** (L085). There is no separate Express server. API routes are the backend.

**No Redis. No message queue. No microservices. No Kubernetes.** (L030) Rate limiting and job state live in Postgres.

## 4 · ARCHITECTURE — NON-NEGOTIABLE

**Modular monolith with a hard JSON API boundary** (L017, L018).

```
React components  →  fetch()  →  /app/api/*  →  service  →  repository  →  Postgres
```

**All business logic lives behind `/app/api/*` returning JSON.** Never in a server component, never in a page. A mobile client will call these same endpoints later — if logic lives in a page, that client has nothing to call.

Layer rules:
- **Route handler** — parse, validate, authorize, call service, shape response. No business logic, no SQL.
- **Service** — business rules, transactions, orchestration. No HTTP awareness, no SQL.
- **Repository** — SQL only. No business rules.

Never skip a layer. Never call the database from a route handler.

## 5 · SECURITY — APPLIES TO EVERY TASK

These are standing requirements. Task-specific security notes are *additions*, never replacements.

1. **`user_id` comes from the session. Never from the request body, query string, or URL.** There is no Supabase RLS (L023) — this is the only thing preventing IDOR.
2. **Fail closed.** Middleware throws → deny. DB unreachable → 503. Rate limiter down → deny. Never `next()` in a catch block. (L076)
3. **Never log** passwords, OTPs, session tokens, API keys, or resume contents.
4. **Never return** `password_hash` or `token_hash` in any response.
5. **Whitelist input fields explicitly.** No spreading request bodies into database writes.
6. **`tier` is never client-writable.** No endpoint in F1 may modify it.
7. **Secrets come from env vars only.** Never hardcoded, never in the client bundle, never committed.
8. **Errors to clients are generic.** Stack traces and DB errors stay server-side.

Read `SECURITY_quarterfinal.md` before any auth, upload, or OAuth work.

## 6 · DEPENDENCIES — SUPPLY CHAIN (A03)

OWASP Top 10:2025 added Software Supply Chain Failures, and it explicitly covers AI-suggested packages that don't exist. Attackers register those names.

**Before adding any package:**
1. Verify it exists: `npm view <package>` — if this errors, the package is not real
2. Check weekly downloads and last publish date. Abandoned or near-zero-download packages are a risk
3. Confirm the repository link resolves to a real project
4. Prefer zero-dependency packages for anything security-adjacent
5. **Ask before adding** anything not already in `package.json`

**Always:**
- `npm ci`, never `npm install`, in the Dockerfile
- `package-lock.json` committed
- Base images pinned by digest, not tag

## 7 · SCOPE — ALLOW-LIST, NOT DENY-LIST

Every task states which files and areas may be touched. **Anything not listed is out of scope by default.**

Do not:
- Refactor code outside the task's scope
- Rename things "for consistency"
- Upgrade dependencies unless the task says so
- Reformat files you didn't otherwise change
- Fix unrelated bugs — note them instead

## 8 · STOP AND ASK

Stop and escalate rather than deciding, when:

- The task conflicts with `DECISIONS.md`
- A schema change outside the task's scope seems necessary
- A destructive migration appears needed
- Authorization behaviour is ambiguous
- A new dependency is required
- The task can't be completed within its stated scope
- A test reveals an architectural problem
- Anything in this file would have to be violated

**Never silently redesign.** A wrong guess that compiles is worse than a question.

## 9 · WORKFLOW

**One task → one approved issue → one branch → one PR.**

**No branch is created before an approved issue exists.** The issue is the frozen contract for the work — see `ISSUES.md`.

**Never edit an approved issue.** If implementation reveals the issue is wrong, stop and comment. Do not adjust the requirements to match what was built, do not widen the allowed file list, do not drop an acceptance criterion. The issue lives outside the repository precisely so it can't be quietly changed to match the code.

Branch naming and commit format in `GIT.md`.

At completion, produce a report using `REPORTS.md`. It must state what changed, which tests were added, and which acceptance criteria are met.

## 10 · ENVIRONMENT

Everything runs in Docker locally: Postgres, Mailpit (SMTP), and the app.

**Local and production differ only by env vars** (L067). If you find yourself writing `if (local)` around business logic, stop — that's a bug. The only legitimate environment branches are the `Secure` cookie flag, the `__Host-` prefix, and the HSTS header, all derived from `NODE_ENV`.

**Never hardcode `localhost`.** Every URL comes from an env var.

## 11 · THINGS THAT WILL WASTE YOUR TIME

- Writing an Express server — Next.js already is one
- Adding a component library — explicitly rejected
- Adding Redis for rate limiting — use Postgres
- Storing PDFs — store text, render client-side (L028)
- Using `pdf-parse` — Gemini reads PDFs natively including scans (L061)
- Building an ORM abstraction layer — write SQL in repositories
- Optimising for scale — at 1,000 users this system uses ~0.05% of a small Postgres instance (L033)

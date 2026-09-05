# Trackr — Documentation Index

Repository layout. Place these at `docs/` (except `CLAUDE.md`, which goes at the repo root where Claude Code finds it).

```
/CLAUDE.md                  ← repo ROOT — read every session
/.github/ISSUE_TEMPLATE/task.md
/Dockerfile
/docker-compose.yml
/.env.example
/docs
  DECISIONS.md              every decision, why, what would reopen it
  FEATURE-A-SPEC.md         F1 spec
  ARCHITECTURE.md           → see BACKEND.md + FRONTEND.md + PLATFORM.md
  BACKEND.md                layering, module boundaries
  FRONTEND.md               component and state conventions
  DATABASE.md               schema, constraints, indexes, migrations
  DATABASE-SECURITY.md      table-level access rules (replaces RLS)
  SECURITY.md               OWASP 2025 threat model — the gaps found
  SECURITY-CONTROLS.md      resolved rules · local vs prod · deploy checklist
  SETUP.md                  ordered checklist: nothing → first task
  PLATFORM.md               Docker, env vars, local vs production
  TESTING.md                what to test and how
  GIT.md                    branches, commits, PRs
  CODECONDUCT.md            code style
  TASKS.md                  35 tasks, dependencies, branch names
  ISSUES.md                 issue-before-branch workflow, frozen contracts
  TASK-REFERENCE.md         task spec template
  REPORTS.md                completion report template
  /sessions
    2026-08-23-stack.md     frozen — verbatim exchanges
    2026-08-24-feature-a.md frozen
```

## Reading order for a new session

1. `CLAUDE.md` — always
2. `TASKS.md` — find your task
3. `ISSUES.md` — an approved issue must exist before any branch
4. The 2–3 documents the issue names

**Do not read everything for every task.** Context discipline is deliberate.

## Which document owns what

| Question | Document |
|---|---|
| Why was this decided? | `DECISIONS.md` |
| What are the exact words that led to it? | `sessions/` |
| What tables exist? | `DATABASE.md` |
| Who can read this table? | `DATABASE-SECURITY.md` |
| What's the threat model? | `SECURITY.md` |
| What's the actual rule, local vs prod? | `SECURITY-CONTROLS.md` |
| How do I deploy safely? | `SECURITY-CONTROLS.md` §12 |
| How do I get started? | `SETUP.md` |
| Where does this code go? | `BACKEND.md` / `FRONTEND.md` |
| How do I run it? | `PLATFORM.md` |
| What do I test? | `TESTING.md` |
| What's next? | `TASKS.md` |
| How does work get authorised? | `ISSUES.md` |

One owner per question. If two documents answer the same question they will drift — fix by deleting one, not by syncing both.

## Archive

`archive/` holds superseded documents — earlier ledger versions and the
pre-stack-change feature analysis. Each carries a header naming what replaced it.
Kept for history; **never** use them as current.

## Status

**Settled:** stack, architecture, F1 schema, security model, all 28 backend tasks.

**Blocked:** 7 frontend tasks (wireframes) · `L066` Gemini quota · `L029` Brevo confirmation · `L074` LinkedIn company Page.

**Not started:** F2 Application Tracker · F3 AI Generation · F4 Follow-up · F5 Post-Call Log · F6 Payments.

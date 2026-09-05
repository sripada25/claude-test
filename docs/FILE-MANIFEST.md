# FILE-MANIFEST.md — Trackr

Every file produced, with modification order, description, and dependencies.

Warning: "Date modified" is the sandbox's file-write timestamp — not a calendar date you can rely on for anything except relative ordering (which file came before which). Ordered oldest-first within each category so drift is visible.

Warning: Found one real problem compiling this: three overlapping design-brief files exist (section 7). Flagged there, not fixed — needs your decision on which survives.

---

# 1 · LIVE - READ THESE FIRST

The seven quarterfinal files plus CLAUDE.md. Everything else is detail these point into.

| File | Modified | Description | Depends on |
|---|---|---|---|
| CLAUDE.md | 2026-09-05 04:27 | Root rules file - read every Claude Code session. Document map, stack lock, security baseline, workflow | Points at every file below |
| PRODUCT-REFERENCE_quarterfinal.md | 2026-09-05 04:28 | Master chain - PRD to feature to task to ledger to schema to screen. Per-feature status dashboard | DECISIONS, DATABASE, SECURITY, TASKS x2 (all quarterfinal) |
| DECISIONS_quarterfinal.md | 2026-09-04 02:47 | Complete ledger, L001-L124. Merges two historical ledgers, corrects contradictions found on audit | DECISIONS.md, DECISIONS-MOCKUP-REVIEW.md (historical sources) |
| DATABASE_quarterfinal.md | 2026-09-03 17:31 | Full schema - F1, F2, F4, F6 tables, forward-declared F3 tables, deletion graph, migration order | DECISIONS_quarterfinal.md for rationale |
| SECURITY_quarterfinal.md | 2026-09-01 20:02 | 14 threat controls, OWASP 2025 mapped, local/prod matrix, 17 required tests | DECISIONS_quarterfinal.md, AI-RULES.md (prompt injection) |
| TASKS_quarterfinal.md | 2026-09-05 04:27 | Backend tasks - F0/F1/F2/F3/F4/F6/P9, 98 total, dependency-ordered, env-marked | DATABASE_quarterfinal.md, SECURITY_quarterfinal.md, AI-RULES.md |
| TASKS-FRONTEND_quarterfinal.md | 2026-09-03 17:16 | Frontend tasks - 62 components across 6 screens, self-contained (CSS/API/DB/security inline per screen) | SCREEN-NOTES-M01 through M06, INTERACTION-STATES.md, DESIGN-SYSTEM.md |
| FRONTEND-COMPONENTS_quarterfinal.md | 2026-09-03 18:13 | Component inventory - 33 components, pen-verified values, performance notes, provenance labels | DESIGN-SYSTEM.md, SCREEN-NOTES-M01 through M06 |

---

# 2 · SCREEN-LEVEL DETAIL

Feeds the two TASKS-*_quarterfinal.md files above. Read when a task references a specific screen section.

## 2a - Screen notes (pen-verified values, per mockup)

| File | Modified | Description |
|---|---|---|
| SCREEN-NOTES-M01.md | 2026-08-28 13:21 | Sign in/Create account - exact pen values |
| SCREEN-NOTES-M02.md | 2026-08-29 19:53 | Profile builder |
| SCREEN-NOTES-M03.md | 2026-08-30 07:41 | Pipeline board |
| SCREEN-NOTES-M04.md | 2026-08-30 10:34 | Add application drawer |
| SCREEN-NOTES-M05.md | 2026-08-30 11:33 | Application detail |
| SCREEN-NOTES-M06.md | 2026-08-30 12:02 | Generate document |
| SCREEN-NOTES-F6-PAYMENTS.md | 2026-09-03 17:40 | Settings/Plan, checkout modal, verifying/failed states, subscription expiry (confirmed empty) |
| SCREEN-NOTES-ADMIN.md | 2026-09-01 20:21 | Admin console mockups - on hold, captured so nothing is lost |

## 2b - Screen specs (full operational depth)

| File | Modified | Description | Status |
|---|---|---|---|
| SCREEN-SPEC-M01.md | 2026-09-03 17:15 | Sign in - full spec | Complete |
| SCREEN-SPEC-M02.md | 2026-09-03 18:07 | Profile builder - full spec | Formatting inconsistent with M01/M03 - see section 8 |
| SCREEN-SPEC-M03.md | 2026-09-03 18:19 | Pipeline board - full spec, largest screen | Complete |
| SCREEN-SPEC-M04.md | 2026-09-05 | Add application drawer - full spec, prompt-injection entry point, Source field resolution | Complete |
| SCREEN-SPEC-M05.md | 2026-09-05 | Application detail - full spec, timeline system, shared status-change service | Complete |
| SCREEN-SPEC-M06.md | 2026-09-05 | Generate document - full spec, quota enforcement, all five screen states | Complete |

## 2c - Supporting design/behavior docs

| File | Modified | Description |
|---|---|---|
| DESIGN-SYSTEM.md | 2026-08-28 03:47 | Token provenance - exact hex, fonts, corner radius, read directly from untitled.pen |
| INTERACTION-STATES.md | 2026-09-03 17:01 | Focus/hover/disabled/error/loading - corrected against verified state variants |
| BOARD-COMPONENT.md | 2026-08-28 15:17 | Drag-and-drop mechanics, jank analysis, scale maths |

---

# 3 · BACKEND SUPPORTING DOCS

| File | Modified | Description |
|---|---|---|
| BACKEND.md | 2026-08-25 10:36 | Layering rules |
| DATABASE-SECURITY.md | 2026-08-25 10:37 | Table-level access rules - the RLS replacement |
| AI-RULES.md | 2026-08-30 13:27 | Gemini contract - all 5 operations, injection defence, quota enforcement |
| PLATFORM.md | 2026-08-25 17:09 | Docker, env vars, local-vs-production |
| TESTING.md | 2026-08-25 10:36 | What to test, test levels |
| CODECONDUCT.md | 2026-08-25 10:37 | Naming, style, comments |

---

# 4 · WORKFLOW & PROCESS

| File | Modified | Description | Note |
|---|---|---|---|
| ISSUES.md | 2026-09-05 05:06 | Frozen-contract issue workflow | Most recently audited, fully current |
| GIT.md | 2026-09-05 04:47 | Branch/commit/PR conventions, merge checklist | Shows both T and F ID examples |
| TASK-REFERENCE.md | 2026-09-05 04:47 | Task specification template | Same fix applied |
| REPORTS.md | 2026-09-05 04:47 | Completion report template | Replaced wholesale with a stronger user-supplied version |
| SETUP.md | 2026-08-25 17:09 | Phase 0-1 checklist | Never executed - no repo exists yet |

---

# 5 · FEATURE-SPECIFIC (F4, Payments, Admin)

| File | Modified | Description | Status |
|---|---|---|---|
| F4-SCREEN-MAP.md | 2026-08-31 14:29 | Which screens F4 touches | Superseded in part by F4-TASKS.md |
| F4-TASKS.md | 2026-08-31 19:20 | F4 in full - both reminder rules, schema, scheduler, API | Live |
| P9-IMPLEMENTATION.md | 2026-09-01 07:11 | Full notes for T7.5 and T9.1-T9.4 | Live |

---

# 6 · POLICY, COST, SUPPORT

| File | Modified | Description |
|---|---|---|
| PRIVACY.md | 2026-08-30 14:41 | Draft privacy policy + enforcement mapping. Needs lawyer review |
| COST-MODEL.md | 2026-08-27 18:23 | Trial economics, generation-cap analysis |
| SUPPORT.md | 2026-08-27 18:41 | Diagnostic queries for user issues without reading content |

---

# 7 · DUPLICATION FOUND - three overlapping design briefs

Compiling this manifest surfaced a real problem: three files serve nearly the same purpose, created at different points, with no clear record of why all three exist.

| File | Modified | Apparent purpose |
|---|---|---|
| DESIGN-BRIEF.md | 2026-09-01 20:29 | Early requirements brief for the human designer - plain language |
| DESIGN-WORK-BRIEF.md | 2026-09-04 03:55 | A file with no recollection of creation. Overlaps heavily with the other two |
| DESIGN-REQUESTS.md | 2026-09-04 16:49 | Most recent, most structured - written for an AI model in pen.dev, exact frame IDs and hex values |

This is the same propagation-drift failure this project has surfaced repeatedly - except here, three documents exist because a request got answered fresh each time rather than checking what already existed.

I cannot confirm which one you actually used without you telling me. DESIGN-REQUESTS.md is newest and most complete, likely the intended survivor, but this is not verified.

Recommendation: confirm which one you used, archive the other two, treat the survivor as the only live design-request document.

---

# 8 · KNOWN INCONSISTENCY

SCREEN-SPEC-M02.md lost its markdown bold/inline-code formatting during a validation-error retry. Content is accurate; style doesn't match M01/M03. Not yet fixed - cosmetic, not functional.

---

# 9 · HISTORICAL - superseded, kept for record, never read for current specs

| File | Superseded by |
|---|---|
| DATABASE.md | DATABASE_quarterfinal.md |
| SECURITY.md | SECURITY_quarterfinal.md |
| SECURITY-CONTROLS.md | SECURITY_quarterfinal.md |
| DECISIONS.md | DECISIONS_quarterfinal.md |
| DECISIONS-MOCKUP-REVIEW.md | DECISIONS_quarterfinal.md |
| TASKS.md | TASKS_quarterfinal.md |
| TASKS-2026-08-26-v2.md | TASKS_quarterfinal.md |
| TASKS-BY-LAYER.md | TASKS_quarterfinal.md |
| FRONTEND-COMPONENTS.md | FRONTEND-COMPONENTS_quarterfinal.md |
| FEATURE-A-SPEC.md | PRODUCT-REFERENCE_quarterfinal.md (retired) |
| F1-READINESS.md | PRODUCT-REFERENCE_quarterfinal.md (retired) |
| README-DOCS.md | this file, functionally |
| project-instructions-v2.md | the original meta-prompt, pre-dates the project |

## archive/ subfolder

- archive/trackr-ledger.md - first ledger version (L001-L016)
- archive/trackr-ledger-v2.md - second ledger, source-quote appendix
- archive/DECISIONS-v2-archive.md - ledger before Part 1/Part 2 restructure
- archive/trackr-feature-analysis-pass1.md - pre-mockup six-feature analysis

## dev-setup/ subfolder

- dev-setup/Dockerfile - production build, ready, unexecuted
- dev-setup/docker-compose.yml - Postgres 16 + Mailpit + profile-gated app, ready, unexecuted
- dev-setup/.env.example - env var template, ready
- dev-setup/.dockerignore - excludes secrets/.git, ready

## github-issue-template/

- github-issue-template/task.md - the ISSUE_TEMPLATE referenced throughout ISSUES.md

---

# 10 · TOTALS

58 files total. 8 live core, 15 screen-level detail, 6 backend supporting, 5 workflow, 3 feature-specific, 3 policy/cost/support, 3 duplicated design briefs (unresolved), 14 historical/archive, 1 unexecuted dev-setup set.

Real action items from this audit:
1. Resolve the three-way design-brief duplication (section 7)
2. Fix SCREEN-SPEC-M02.md's formatting (section 8)
3. DONE - all six SCREEN-SPEC files now written (M01-M06)
4. Execute SETUP.md - no repository exists (section 4)

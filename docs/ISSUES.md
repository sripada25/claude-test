# ISSUES.md — Trackr

GitHub Issues as a **control mechanism**, not a coordination tool.

You are one developer. Issues here don't exist to assign work or track who's doing what — they exist so that **the definition of a task is frozen before the work starts**, in a place the coding agent cannot silently edit.

---

# 1 · WHY THIS EXISTS

If the same agent both defines the work and does the work, there is nothing to check the result against. Scope drifts, and the drift looks intentional in the diff.

An issue approved before implementation is a **fixed target**. The PR either hits it or misses it, and the difference is visible without reading much code.

**The critical property:** `TASKS_quarterfinal.md`, `TASKS-FRONTEND_quarterfinal.md`, and every other doc live inside the working directory. An agent hitting friction can adjust a spec to match what it actually built. **An issue is outside the repo — the coding agent cannot reach it.**

That's the whole argument. Everything below follows from it.

---

# 2 · THE FLOW

```
TASKS_quarterfinal.md              backend map — 98 tasks, dependencies, status
TASKS-FRONTEND_quarterfinal.md     frontend map — 62 components, self-contained
      ↓
GitHub Issue          the frozen contract, created BEFORE any code
      ↓  ← YOUR GATE: review and approve
branch t1.2-users-table
      ↓
PR "closes #12"       the delivery
      ↓  ← YOUR GATE: does this match what the issue said?
merge → tick ✅ in `TASKS_quarterfinal.md` or `TASKS-FRONTEND_quarterfinal.md`
```

Two gates, neither requiring you to read much code:

**Gate 1 — before work.** Is the scope right? Are the acceptance criteria testable? Is the allowed file list correct?

**Gate 2 — after work.** Did the PR do what the issue said? Did it touch files the issue didn't authorise?

---

# 3 · THE FROZEN CONTRACT RULE

**Once an issue is approved, it does not change.**

If implementation reveals the issue is wrong — a missing requirement, an impossible constraint, an unforeseen dependency — the agent **stops and asks**. It does not:

- Edit the issue to match what it built
- Widen the allowed file list mid-task
- Add requirements it decided were necessary
- Quietly drop an acceptance criterion

A revised issue gets a **comment stating what changed and why**, and needs your re-approval before work resumes. The original text stays visible.

This mirrors `CLAUDE.md` §8 (stop and escalate) and L015 (version-pinned approval — approval binds to a fixed artifact, not to a word someone can retype).

---

# 4 · ISSUE TEMPLATE

Derived from `TASK-REFERENCE.md`. Save as `.github/ISSUE_TEMPLATE/task.md`.

```markdown
---
name: Task
about: A single implementation task from TASKS_quarterfinal.md or TASKS-FRONTEND_quarterfinal.md
title: '[T_._ or F_-_._] '
labels: task
---

## [T_._ or F_-_._] <Title>

**Feature:** F1 — User Accounts
**Depends on:** T_._ — must be MERGED, not merely approved
**Branch:** `t_._-<slug>`

### Objective
One or two sentences. What exists after this that didn't before.

### Background
Why this task exists. Ledger IDs it implements (e.g. "implements L069").

### Read before starting
- CLAUDE.md
- <2–3 specific documents — not all of them>

### Allowed scope
Files that may be created or modified:
- `path/to/file.ts`

**Anything not listed is OUT OF SCOPE.**

### Deliberately excluded from your context
Adjacent things you cannot see and must not assume:
- <e.g. "the frontend — wireframes pending">

### Requirements
1. [EXPLICIT] ...
2. [ASSUMPTION] ...

### Database impact
Tables touched. Migration required? Reversible?

### Security requirements
IN ADDITION to the CLAUDE.md §5 baseline, which always applies:
- <task-specific controls only>

### Tests required
- Unit / Integration / Security (reference SECURITY_quarterfinal.md §6 by number)

### Acceptance criteria
- [ ] Testable statements, each mapping to a test

### Stop and escalate if
- <task-specific conditions, beyond CLAUDE.md §8>

---
**Approved by:** <your name> · <date>
**Status:** Draft | Approved | In progress | Delivered
```

---

# 5 · MAKING IT CHEAP

Don't hand-write these. Ask Claude Code:

> "Draft a GitHub issue for T1.2 using `.github/ISSUE_TEMPLATE/task.md`, sourced from `TASKS_quarterfinal.md` and `DATABASE_quarterfinal.md` §2.1. Do not create the branch."

You review, correct, approve. Minutes, not hours.

**Draft several at once** for independent tasks — T1.2 through T1.8 have no interdependencies beyond T1.1, so they can be specified in one batch and worked sequentially.

---

# 6 · WHAT TO CHECK AT EACH GATE

## Gate 1 — approving the issue

- [ ] Objective is one thing, not three
- [ ] Allowed scope lists specific files, not folders or wildcards
- [ ] Acceptance criteria are testable, not aspirational
- [ ] Security section says "in addition to the baseline", never "the security requirements are"
- [ ] Assumptions are tagged `[ASSUMPTION]`, not presented as fact
- [ ] Dependencies are actually merged

## Gate 2 — reviewing the PR

- [ ] `closes #N` is present and points at the right issue
- [ ] **Files changed ⊆ allowed scope** — the fastest scope-creep check available
- [ ] Every acceptance criterion ticked, or explicitly explained
- [ ] Tests exist for each security requirement
- [ ] Report present (`REPORTS.md` template)
- [ ] "Decisions made during implementation" section says **"None."** or lists decisions that are also in `DECISIONS_quarterfinal.md` — a **blank** section is incomplete, not equivalent to "None."
- [ ] "Noticed but not fixed" — each item has a follow-up task ID or a stated reason for not creating one

⚠️ This gate is manual — see `GIT.md` §4 for the same note. A CI check to make this a real merge gate is planned for when the project moves to a hosting platform (`TASKS_quarterfinal.md`, Operations).

**The file-list check is the highest-value thing you do.** It takes thirty seconds and catches the failure mode you're guarding against, without reading a line of logic.

---

# 7 · LABELS

Keep it minimal — labels you don't use are noise.

| Label | Meaning |
|---|---|
| `task` | Planned implementation task from `TASKS_quarterfinal.md` or `TASKS-FRONTEND_quarterfinal.md` |
| `blocked` | Waiting on an external dependency (L066, L074, wireframes) |
| `security` | Touches auth, sessions, uploads, or OAuth — needs the second review pass |
| `bug` | Found outside planned work |

No priority labels. `TASKS_quarterfinal.md` and `TASKS-FRONTEND_quarterfinal.md` already encode order through dependencies.

---

# 8 · WHAT NOT TO PUT IN ISSUES

- **Architecture decisions** → `DECISIONS_quarterfinal.md`. An issue is a work order, not a decision record.
- **Duplicated spec content** → link to `DATABASE_quarterfinal.md` §2.1, don't paste it. Two copies drift.
- **Ongoing discussion of direction** → that belongs in the ledger, where it's searchable and versioned.

The issue holds what's *specific to this unit of work*. Everything general lives in the docs and gets referenced.

---

# 9 · WHEN THIS GETS LIGHTER

Once you've done ten tasks and trust the loop, some steps can relax — batching several small tasks into one issue, or skipping issues for trivial changes like fixing a typo in a comment.

**Don't relax it for anything in the high-risk list** (`TASKS_quarterfinal.md`'s TOTALS section): T2.3 session middleware, T4.3 account linking, T5.1 the AI provider interface, T7.5 trust-proxy handling, F2-2.2/F2-2.3 soft-delete filtering, F3-2.2 résumé tailoring (must reject fabricated content, not save it), F3-2.5 quota decrement (a bug here is a billing event, not a UI bug). Those are load-bearing for multiple later features.

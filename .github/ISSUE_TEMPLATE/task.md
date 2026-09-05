---
name: Task
about: A single implementation task from TASKS.md
title: '[T_._] '
labels: task
---

## [T_._] <Title>

**Feature:** F1 — User Accounts
**Depends on:** T_._ — must be MERGED, not merely approved
**Branch:** `t_._-<slug>`

### Objective
<!-- One or two sentences. What exists after this that didn't before. -->

### Background
<!-- Why this task exists. Ledger IDs it implements, e.g. "implements L069". -->

### Read before starting
- CLAUDE.md
- <!-- 2–3 specific documents. Not all of them. -->

### Allowed scope
<!-- Specific files. Not folders, not wildcards. -->
- `path/to/file.ts`

**Anything not listed is OUT OF SCOPE. Stop and ask rather than widening it.**

### Deliberately excluded from your context
<!-- Adjacent things the implementer cannot see and must not assume. -->
-

### Requirements
1. [EXPLICIT]
2. [ASSUMPTION]

### Database impact
<!-- Tables touched. Migration required? Reversible? "None" is a valid answer. -->

### Security requirements
IN ADDITION to the `CLAUDE.md` §5 baseline, which always applies:
-

### Tests required
- **Unit:**
- **Integration:**
- **Security:** <!-- reference SECURITY.md §6 by number -->

### Acceptance criteria
- [ ]
- [ ]

### Stop and escalate if
<!-- Task-specific conditions, beyond CLAUDE.md §8. -->
-

---

**Approved by:** <!-- name --> · <!-- date -->
**Status:** Draft

<!--
FROZEN CONTRACT: once Status is Approved, this issue does not change.
If implementation reveals a problem, STOP and comment — do not edit the
requirements to match what was built. See ISSUES.md §3.
-->

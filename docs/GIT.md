# GIT.md — Trackr

Private repository. One task → one branch → one PR.

---

# 0 · BEFORE ANY BRANCH

**An approved GitHub issue must exist first.** See `ISSUES.md`.

The issue is the frozen contract. It sits outside the repository, so the coding agent cannot edit it to match what it built. No approved issue → no branch.

# 1 · BRANCHES

```
main                    protected, always deployable
t1.2-users-table        one branch per task ID
```

Format: `<task-id>-<short-slug>`, lowercase, hyphens. Task ID from `TASKS_quarterfinal.md` (backend) or `TASKS-FRONTEND_quarterfinal.md` (frontend).

```
t2.3-session-middleware
t4.3-oauth-account-linking
t5.4-parse-resume-endpoint
f2-2.4-application-patch-endpoint
f3-2.5-quota-decrement
f6-1-checkout-order
```

⚠️ **The rule applies identically to both ID schemes.** `T`-prefixed IDs (F1/F2 tasks) and `F`-prefixed IDs (F3/F4/F6 tasks) both lowercase to the same branch-naming pattern — there's no separate convention for either.

Never work directly on `main`. Never combine two tasks in one branch.

# 2 · COMMITS

```
<type>(<task-id>): <what changed>

Types: feat · fix · test · docs · chore · refactor · security
```

```
feat(t1.2): add users table with citext email
security(t2.3): fail closed on session resolution error
test(t3.2): assert login does not leak account existence
```

Present tense, imperative. Explain *why* in the body when it isn't obvious.

# 3 · PULL REQUESTS

Title: `[T2.3] Session middleware`

**Body must open with `closes #N`** — linking the PR to its approved issue. A PR with no issue link cannot be reviewed against anything.

Body must contain:
- Task ID and what it implements
- Decisions honoured (e.g. "implements L076 fail-closed")
- Files changed and why
- Tests added
- Acceptance criteria status
- Anything noticed but deliberately not fixed

Use the `REPORTS.md` template.

**The reviewer's first check is mechanical:** are the files changed a subset of the issue's allowed scope? Thirty seconds, and it catches scope creep without reading any logic.

# 4 · REQUIRED BEFORE MERGE

- [ ] All tests pass
- [ ] Security tests for this task pass (`SECURITY_quarterfinal.md` §6)
- [ ] `npm audit` clean of high/critical
- [ ] No secrets in the diff
- [ ] Scope respected — no unrelated files touched
- [ ] Migration is reversible, if any
- [ ] `DECISIONS_quarterfinal.md` updated if a decision was made or changed
- [ ] **`REPORTS.md`'s "Decisions made during implementation" section is filled in** — even if the answer is "None." A blank section is not the same as "None" and should be treated as incomplete
- [ ] **`REPORTS.md`'s "Noticed but not fixed" items each have a follow-up task ID or a stated reason for having none**

⚠️ **This checklist is read by a human or an agent, not enforced by tooling.** Nothing currently blocks a merge if these boxes are unchecked — see `TASKS_quarterfinal.md`'s Operations group for the planned CI check (added when moving to a real hosting platform) that will make the "Decisions made" and "Noticed but not fixed" requirements a genuine merge gate rather than a checklist someone can skip.

# 5 · BRANCH PROTECTION

Configure on `main` before the first PR:
- Require a PR — no direct pushes
- Require status checks to pass
- No force-push, no deletion

Enforced as a repository setting, not a convention (L015).

# 6 · NEVER COMMIT

```
.env                  API keys              *.pem / *.key
node_modules/         database dumps        real user data
.next/                *.log
```

`.gitignore` these from the first commit. A secret committed once is in history forever — rotate it rather than trying to remove it.

# 7 · IF A SECRET IS COMMITTED

1. Rotate the credential immediately — assume compromise
2. Only then worry about history
3. Log it as a security event

Speed of rotation matters more than cleanliness of history.

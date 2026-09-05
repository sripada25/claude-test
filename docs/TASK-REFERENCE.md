# TASK-REFERENCE.md — Trackr

Template for specifying a task before it is worked. Copy, fill, put in the GitHub issue.

Keep it short. A task spec longer than the code it produces is a smell.

---

# TEMPLATE

```markdown
## [T_._ or F_-_._] <Title>

**Feature:** F1 — User Accounts
**Depends on:** T_._ (must be MERGED, not merely approved)
**Branch:** t_._-<slug>

### Objective
One or two sentences. What exists after this that didn't before.

### Background
Why this task exists. Link the ledger IDs it implements (e.g. "implements L069").

### Read before starting
- CLAUDE.md
- <2–3 specific documents, not all of them>

### Allowed scope
Files and folders that may be created or modified:
- /lib/services/auth.ts
- /migrations/00X_*.sql

Anything not listed is OUT OF SCOPE by default.

### Deliberately excluded from your context
Adjacent things you cannot see and should not assume:
- <e.g. "the frontend — wireframes pending">
- <e.g. "F2's tracker tables — not yet designed">

### Requirements
Numbered, testable statements. Tag assumptions.
1. [EXPLICIT] ...
2. [ASSUMPTION] ...

### Database impact
Tables touched. Migration required? Reversible?

### Security requirements
IN ADDITION to the CLAUDE.md §5 baseline, which always applies:
- <task-specific controls only>

### Tests required
- Unit: ...
- Integration: ...
- Security: ... (reference SECURITY_quarterfinal.md §6 by number)

### Acceptance criteria
- [ ] Verifiable statements, each mapping to a test

### Stop and escalate if
- <task-specific conditions, beyond CLAUDE.md §8>
```

---

# WORKED EXAMPLE

```markdown
## [T2.3] Session middleware

**Feature:** F1 — User Accounts
**Depends on:** T2.2 (session service) — MERGED
**Branch:** t2.3-session-middleware

### Objective
A single middleware that resolves the session cookie to a user context on every
request, or denies. After this, no other code reads session cookies.

### Background
This is the sole place identity is established in Trackr. With Supabase RLS
rejected (L023), every authorization check downstream depends on this being
correct. Implements L044 (server-side sessions) and L076 (fail closed).

### Read before starting
- CLAUDE.md
- SECURITY_quarterfinal.md §G2, §3
- DATABASE_quarterfinal.md §2.3

### Allowed scope
- /lib/security/session-middleware.ts
- /lib/security/session-middleware.test.ts
- /middleware.ts

Anything not listed is OUT OF SCOPE.

### Deliberately excluded from your context
- Route handlers — they consume this, they don't change in this task
- OAuth flow (P4) — not built yet
- Frontend — wireframes pending

### Requirements
1. [EXPLICIT] Read the session cookie, hash it, look up a non-revoked,
   non-expired session, attach `userId` to request context.
2. [EXPLICIT] On ANY error — DB unreachable, malformed cookie, unexpected
   exception — DENY. Never call next().
3. [EXPLICIT] Emit `session_resolution_failed` to security_events on exception.
4. [ASSUMPTION] Public routes are allow-listed by path prefix; everything
   else requires a session. Confirm the list before implementing.

### Database impact
Reads `sessions` and `users`. No migration.

### Security requirements
IN ADDITION to CLAUDE.md §5:
- Constant-time comparison is NOT needed here (lookup is by hash, indexed)
- Never log the raw cookie value
- Denial responses are identical whether the session is missing, expired,
  or revoked — no information leak about session state

### Tests required
- Unit: expired session rejected; revoked session rejected
- Integration: valid session attaches correct userId
- Security: SECURITY_quarterfinal.md §6 test #7 — inject a DB failure into session
  resolution, assert the request is DENIED, not allowed

### Acceptance criteria
- [ ] Valid session ⇒ userId in context
- [ ] Expired ⇒ 401
- [ ] Revoked ⇒ 401
- [ ] DB throws ⇒ 401 (NOT 500, NOT allowed through)
- [ ] Security event emitted on exception
- [ ] No other file in the repo reads session cookies directly

### Stop and escalate if
- The public-route allow-list is ambiguous
- Next.js middleware cannot access the database in this runtime
  (edge vs node) — this materially affects the design
```

---

# NOTES

**The "deliberately excluded" section matters.** Context is deliberately narrow (§24). Stating what was withheld turns blind spots into known unknowns, so a genuine conflict surfaces as a question rather than being silently missed.

**Tag assumptions.** A requirement marked `[ASSUMPTION]` reads differently from `[EXPLICIT]` — it tells the implementer this is a judgment call that can be challenged.

**Security requirements are additions.** The `CLAUDE.md` §5 baseline always applies. Listing three task-specific controls must never read as "these are the only three".

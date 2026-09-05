# CODECONDUCT.md — Trackr

How code is written here. Style is settled so it stops being a decision.

---

# 1 · TYPESCRIPT

- **`strict: true`.** Non-negotiable.
- **No `any`.** Use `unknown` and narrow. If you truly need `any`, comment why.
- Types live next to what they describe; shared types in `/types`.
- Prefer `type` for unions and objects, `interface` for extendable contracts.
- No non-null assertions (`!`) — handle the null case.

# 2 · NAMING

```
files          kebab-case      session-middleware.ts
components     PascalCase      ProfileForm.tsx
functions      camelCase       resolveSession()
constants      UPPER_SNAKE     MAX_OTP_ATTEMPTS
db columns     snake_case      email_verified_at
types          PascalCase      ExtractedProfile
```

Boolean names read as assertions: `isVerified`, `hasProfile`, `canGenerate`.

Functions are verbs. `getUserById`, not `userById`.

# 3 · FUNCTIONS

- One responsibility. If the name needs "and", split it.
- Early returns over nested conditionals.
- Under ~50 lines. Longer usually means two functions.
- Under ~4 parameters — beyond that, take an options object.

# 4 · COMMENTS

Explain **why**, never **what**.

```typescript
// BAD — restates the code
// increment the counter
counter++;

// GOOD — explains a decision
// Quota is keyed on calendar month, not billing period: a user who
// subscribes on the 20th should still reset on the 1st (L034 rationale).
const periodStart = startOfMonth(now);
```

Reference ledger IDs when implementing a decision. Someone reading it in six months can find the reasoning.

# 5 · ERRORS

- Services return typed results; throw only for genuinely exceptional conditions.
- **Never swallow an error.** Log it or propagate it.
- Auth-path catch blocks default to the restrictive branch (L076).
- Client-facing messages are generic. Detail stays server-side.

# 6 · IMPORTS

Order: external → internal absolute → relative. Absolute imports via `@/` for anything outside the current folder.

**No circular imports.** If two modules need each other, a boundary is wrong — escalate rather than working around it.

# 7 · WHAT NOT TO DO

- Don't add a dependency to avoid ten lines of code
- Don't build an abstraction for a single use case
- Don't optimise without a measurement
- Don't leave commented-out code — git remembers
- Don't leave `console.log` in committed code
- Don't reformat files you didn't otherwise change (it destroys the diff)
- Don't fix unrelated bugs in a task's PR — note them, file them

# 8 · BEFORE OPENING A PR

- [ ] Typecheck passes
- [ ] Tests pass, including the security tests for this task
- [ ] No secrets, no `console.log`, no commented-out blocks
- [ ] Scope respected — only files the task allows
- [ ] Ledger IDs referenced where a decision is implemented

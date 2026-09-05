# REPORTS.md — Trackr

Completion report template. One per merged task, in the PR body.

Purpose: answer **"why is it built this way?"** six months from now without re-reading the code, PR discussion, or implementation conversation.

A report is part of the project's architectural record. It must make clear:

* what was built
* why it was built that way
* which decisions and requirements drove it
* what was verified
* what was deliberately not done
* which new decisions were made during implementation

---

# TEMPLATE

```markdown
## Report — [T_._ or F_-_._] <Title>

**Branch:** t_._-<slug> (or f_-_._-<slug>)
**Merged:** YYYY-MM-DD
**Status:** Complete | Partial | Blocked

---

### Scope

Included:
- ...

Explicitly not included:
- ...

### What was built

Two or three sentences. Describe what exists now that did not exist before.

### Why it was built this way

Explain the implementation decisions that matter six months from now.

Each significant architectural, security, data, or product decision must reference
its ledger ID.

- Implements **L0XX** — <what the decision requires>
- Constrained by **L0XX** — <how the decision shaped the implementation>
- Security requirement **GXX** — <how the implementation satisfies it>

Business requirement traced:

> "<verbatim requirement from the PRD or decision ledger>"

Source: `PRD p.X` / `DECISIONS_quarterfinal.md#L0XX` /
`sessions/<file>.md#S-XX`

### Files changed

| File | Change | Why |
|---|---|---|
| ... | created / modified / deleted | ... |

### Database changes & migration

Migration: `00X_name.sql`

- Reversible: yes / no — <reason if no>
- Down migration tested: yes / no / N/A
- Tables changed: ...
- Columns changed: ...
- Constraints: ...
- Indexes: ...
- Enums / functions / triggers / views / RLS policies: ...
- Justification: ...

If there are no database changes, say:

> None.

### Security controls implemented

- **<control>** — implementation: <what was done>; verification: <test/reference>
- **<control>** — implementation: <what was done>; verification: <test/reference>

Security requirements from `SECURITY_quarterfinal.md §6` covered:
`G1, G2, ...`

### Tests

| Test | Type | Asserts |
|---|---|---|
| ... | unit / integration / security / e2e | ... |

Test result:
- Passed: ...
- Failed: ...
- Skipped: ...

If a required test could not be run, explain why.

### Acceptance criteria

- [x] <criterion>
- [ ] <criterion> — reason: <why it was not met>

Every unchecked criterion must have a reason.

### Decisions made during implementation

Anything decided during implementation that was not already captured
in the specification or decision ledger.

Each decision must be added to `DECISIONS_quarterfinal.md` before this
report is considered complete.

- **L0XX** — <decision and rationale>

If no new decisions were made:

> None.

### Noticed but not fixed

Issues deliberately left unresolved because they are out of scope,
deferred, or require a separate decision.

- <issue> — reason: <why it was not fixed> — follow-up: **T_._**
- <issue> — reason: <why no follow-up task was created>

Every actionable issue must either have a follow-up task ID or explicitly
state why no task was created.

### Follow-up tasks created

- **T_._** — <description>
- **T_._** — <description>

If none:

> None.
```

---

# WORKED EXAMPLE (abridged)

```markdown
## Report — [T4.3] OAuth callback and account linking

**Branch:** t4.3-oauth-account-linking
**Merged:** 2026-09-XX
**Status:** Complete

### Scope

Included:
- Google OAuth callback handling
- Linking a verified Google identity to an existing Trackr account
- Protection against credential takeover during account linking

Explicitly not included:
- LinkedIn OAuth
- Account unlinking
- Multi-provider conflict resolution

### What was built

The Google OAuth callback handler, plus the account-linking rule that decides
whether an incoming Google identity joins an existing Trackr account.

When an existing account has an unverified password credential, successful
Google linking invalidates that password credential.

### Why it was built this way

- Implements **L069** — auto-link on verified email, but invalidate the
  password credential if the existing account was never verified.
- Constrained by **L025** — no provider-specific data in the schema beyond
  the OIDC `sub` claim, keeping pg_dump portability intact.
- Security requirement **G1** — OAuth state must be verified against the
  initiating session before the authorization code is exchanged.

Business requirement traced:

> "sso login(google, linkedin) … for registration(google, linkedin)"

Source: `DECISIONS_quarterfinal.md#L068`,
`sessions/2026-08-25-*.md`

The password-invalidation branch is not a product requirement. It closes a
pre-registration account-takeover path: an attacker could create an account
using a victim's email address and an unverified password, after which the
victim could legitimately authenticate through Google. Without invalidating
the previously established password credential, that credential would remain
valid for the account after the victim linked their Google identity.

### Files changed

| File | Change | Why |
|---|---|---|
| `api/auth/google/callback.ts` | modified | OAuth callback and account-linking logic |
| `auth/account-linking.ts` | created | Isolates credential-linking rules |
| `auth/account-linking.test.ts` | created | Tests takeover-prevention behavior |

### Database changes & migration

None — `oauth_accounts` was created in T1.6.

### Security controls implemented

- **OAuth state validation** — implementation: state is matched against the
  initiating session before code exchange; verification: security test #6.
- **Unverified-password invalidation** — implementation: password credential
  is invalidated when linking the verified Google identity; verification:
  security test #5.
- **Security event logging** — implementation:
  `password_invalidated_by_oauth_link` is emitted to `security_events`;
  verification: security event test.
- **Redirect URI validation** — implementation: redirect URI is matched
  exactly and `redirect_to` is not accepted from the query string;
  verification: redirect validation test.

Security requirements from `SECURITY_quarterfinal.md §6` covered:
`G1, G5, G6`

### Tests

| Test | Type | Asserts |
|---|---|---|
| links to verified account | integration | Google identity links successfully |
| invalidates unverified password | security | previous password credential is rejected (#5) |
| rejects state mismatch | security | callback is denied (#6) |
| rejects arbitrary redirect | security | redirect cannot be controlled by query parameter |

Test result:
- Passed: all required tests
- Failed: none
- Skipped: none

### Acceptance criteria

- [x] Google OAuth callback completes successfully.
- [x] Verified Google identity links to the matching existing account.
- [x] Unverified password credential is invalidated during linking.
- [x] OAuth state is validated before code exchange.
- [x] Redirect URI cannot be overridden by request parameters.

### Decisions made during implementation

- **L0XX** — Google returned `email_verified: false` for one test account.
  Chose to fall back to OTP rather than link the identity.

Added to `DECISIONS_quarterfinal.md` as **L0XX** before merge.

### Noticed but not fixed

- `GET /api/auth/session` returns the full profile on every call — wasteful
  once the profile grows. Out of scope. Follow-up: **T_._**

### Follow-up tasks created

- **T_._** — Return only the required session fields from
  `GET /api/auth/session`.
```

---

# WHY THIS EXISTS

Three questions this answers that code alone cannot:

1. **Why is this branch here?**
   The takeover scenario above is invisible in the diff. It looks like
   defensive coding until the report explains the threat it closes.

2. **What was decided mid-flight?**
   Implementation almost always exposes choices the original specification
   missed. Those choices must become explicit ledger entries rather than
   undocumented architecture.

3. **What was deliberately left?**
   The report distinguishes between **not implemented**, **out of scope**,
   **deferred**, and **blocked** work.

The report should allow a future engineer to reconstruct the reasoning behind
the implementation without reopening the original PR discussion.

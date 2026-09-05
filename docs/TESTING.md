# TESTING.md — Trackr

Every acceptance criterion maps to at least one test. Every security requirement maps to a security test.

---

# 1 · STACK

```
Vitest              unit + integration
Testcontainers      real Postgres per test run — never mocked
Playwright          E2E (add with the frontend)
```

**Do not mock the database.** Constraints, cascades, and transactions are half of what needs testing. A mocked repository proves nothing about a `CHECK` constraint.

# 2 · LEVELS

| Level | Tests | Speed |
|---|---|---|
| Unit | Pure logic — hashing, OTP generation, completeness rules | ms |
| Integration | Route → service → repository → real Postgres | seconds |
| Security | Explicit attack simulations | seconds |
| E2E | Full user journeys through the browser | slow, few |

Most value is in **integration**. Unit tests for pure functions, E2E for the two or three journeys that matter.

# 3 · REQUIRED SECURITY TESTS

Each must exist before F1 is done. From `SECURITY.md` §6:

| # | Test |
|---|---|
| 1 | User A cannot read or write user B's profile via any endpoint |
| 2 | Login returns identical response and timing for unknown email vs wrong password |
| 3 | Signup does not reveal whether an email is registered |
| 4 | Rate limiter blocks after N failed attempts |
| 5 | **Pre-registration takeover** — unverified password account + Google sign-in ⇒ old password dead (L069) |
| 6 | OAuth `state` mismatch is rejected |
| 7 | **Session middleware throwing ⇒ request denied, not allowed** (L076) |
| 8 | `tier` and `user_id` unwritable via `PUT /api/profile` |
| 9 | Non-PDF, oversized, and encrypted PDFs rejected cleanly |
| 10 | OTP: expired, wrong, over-attempt — lockout holds |
| 11 | Logged-out session token rejected immediately |
| 12 | Deleting a user leaves no orphaned rows |
| 13 | A user cannot remove their last remaining credential |

Test #7 is the one teams skip. Inject a failure into session resolution and assert denial — this is OWASP's new A10 category and it only manifests when a dependency breaks.

# 4 · WRITING THEM

```typescript
// Name the behaviour, not the function
it('rejects a session token after logout', ...)      // good
it('testSessionService', ...)                        // bad

// Assert the security property, not the happy path
it('returns the same error for unknown email and wrong password', async () => {
  const a = await login('nobody@example.com', 'whatever');
  const b = await login(existingUser.email, 'wrongpassword');
  expect(a.status).toBe(b.status);
  expect(a.body.error).toBe(b.body.error);
});
```

Each test creates its own data and cleans up. No shared fixtures that leak state between tests.

# 5 · LOCAL VS PRODUCTION

**Runs identically in both:** everything above. Same container, same code.

**Cannot be tested locally:**

| | Verify how |
|---|---|
| TLS chain | SSL Labs after deploy |
| Email deliverability | mail-tester.com — check the DKIM signature |
| Proxy header handling | Log the resolved client IP on first deploy and confirm it isn't the proxy's |
| Load behaviour | Only under real traffic |

Add a **post-deploy smoke test**: signup, verify, login, logout against production. Five minutes, catches config errors that unit tests can't see.

# 6 · CI

On every PR:
```
npm ci
npm run typecheck
npm run test
npm audit --audit-level=high
```

⚠️ CI must **never** run untrusted PR code with access to deploy secrets.

# 7 · COVERAGE

No percentage target — it incentivises testing trivia. Instead:

- Every API endpoint has at least one integration test
- Every security requirement has a named test
- Every `CHECK` constraint and cascade has a test proving it fires
- Every bug found gets a regression test before the fix

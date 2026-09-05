# F1-READINESS.md — Is Feature A complete?

Audited 2026-08-25.

---

# THE HONEST ANSWER

| | Status |
|---|---|
| **Built** | **0%** — no code exists |
| **Backend specified** | **~97%** — 37 tasks ready to implement |
| **Frontend specified** | **0%** — blocked on wireframes |
| **Overall F1 specified** | **~85%** |

**You can start now.** 37 tasks is several weeks of work, and none of it waits on anything you don't have.

---

# WHAT IS SETTLED

**Schema — complete.** 12 tables, all constraints, all indexes justified, full deletion graph, one cross-table invariant documented in `DATABASE.md` §3.

**Security — 10 OWASP 2025 gaps found and resolved**, each with explicit local vs production rules (`SECURITY-CONTROLS.md`). 13 required security tests named.

**Decisions — 89 logged**, each with reasoning and what would reopen it.

**Auth model — complete.** Password + Google SSO, account linking with the pre-registration takeover closed, OTP verification, forgot-password that works for SSO-only accounts, connected-accounts management with a last-credential guard.

**Deployment — specified.** Container contract, env matrix (14 rows, all config), pre/post-deploy checklists.

---

# WHAT IS NOT SETTLED

## Blocked externally

| | Blocks | Resolution |
|---|---|---|
| **Wireframes** | All 7 frontend tasks (P8) | Days away |
| **L029** Brevo unconfirmed | T3.5 — verification emails | Your call; Mailpit covers local |
| **L066** real Gemini quota | T5.2/T5.4 sizing | Read it in AI Studio during Phase 2 |
| **L074** LinkedIn company Page | T4.4 only | Google SSO unaffected |

## Open design questions

| | Affects | My recommendation |
|---|---|---|
| Session absolute expiry vs sliding renewal | T2.2 | 30-day fixed. Sliding keeps a stolen token alive indefinitely. |
| Does `contact_email` need its own verification? | T4.5, F4 | **Yes.** Otherwise someone sets an address they don't control and recruiter replies route there. |
| Account-level OTP lockout vs per-token | T3.5 | Account-level. Per-token lets an attacker keep requesting fresh codes. |

None block starting. All three should be answered before the task that needs them.

---

# GAPS FOUND IN THIS AUDIT — now closed

**Round 1:** account deletion endpoint · revoke-all-sessions · connected-accounts API.

**Round 2:**

| Gap | Why it mattered |
|---|---|
| **`oauth_states` table missing** | `SECURITY-CONTROLS.md` §1 told T4.1 to store `state` in a table that `DATABASE.md` never defined. T4.1 would have stalled or invented one. |
| **No `/api/health` task** | Railway's health check fails without it — **the deploy silently never goes live**. |
| **No backup job task** | L089 decided it runs in-container; nothing scheduled it. |
| **No trust-proxy task** | The single control needing code rather than config. Missing it means the rate limiter counts every attacker as one IP. |
| **No env-validation task** | Missing secrets should crash at boot, not surface as a 500 during someone's signup. |
| **No expiry sweep** | `oauth_states`, `verification_tokens` and `auth_attempts` grow forever. |

**Both rounds found the same failure mode: a decision recorded in one document that never reached the schema or the task list.** Re-run this audit after F2 is designed.

---

# THE REAL ANSWER TO "IS IT 100%?"

No — and it shouldn't be before you write code.

Three things will only become clear during implementation: whether Next.js middleware can reach the database in your chosen runtime (this materially affects T2.3's design), whether Gemini's extraction quality on real resumes justifies the mandatory review step, and whether the issue-approval loop is worth its overhead at this scale.

**Planning has hit diminishing returns.** The next genuine information comes from building T1.1, T1.2 and T2.1 — not from another specification pass.

---

# START HERE

1. `SETUP.md` Phase 0 — repo, docs, `.gitignore`, branch protection
2. `SETUP.md` Phase 1 — Docker, Node 24, Next.js scaffold, Dockerfile
3. **T1.1** migration tooling → **T1.2** `users` table → **T2.1** Argon2id

Run those three deliberately. You're testing the control loop, not the code.

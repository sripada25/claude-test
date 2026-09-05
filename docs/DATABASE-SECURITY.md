# DATABASE-SECURITY.md — Trackr

Table-level access rules. **There is no Row-Level Security** — Supabase was rejected (L023), so every ownership check is application code. This document is what replaces RLS.

---

# 1 · THE ONE RULE

> **`user_id` comes from the resolved session. Never from a request body, query string, or URL path.**

```typescript
// WRONG — trivially exploitable
const profile = await getProfile(req.body.userId);
const profile = await getProfile(params.id);

// RIGHT
const { userId } = await requireSession(req);
const profile = await getProfile(userId);
```

Every repository function that touches user-scoped data takes `userId` as its **first parameter**, supplied by the service from session context. No exceptions, no "internal" helpers that skip it.

# 2 · PER-TABLE ACCESS

| Table | Read | Write | Notes |
|---|---|---|---|
| `users` | own row | own row, limited fields | `password_hash` never leaves the repository. `email` changes only via the verified flow. |
| `profiles` | own row | own row, whitelisted fields | `user_id` and `completed_at` are never client-writable |
| `sessions` | own rows | create/revoke own | `token_hash` never returned in any response |
| `verification_tokens` | **never exposed** | service only | No endpoint returns a token or its hash |
| `oauth_accounts` | own rows | link/unlink own | `provider_user_id` never client-supplied |
| `subscriptions` | own row | **no client write path in F1** | `tier` is the privilege-escalation target — guard it |
| `generation_quota` | own row | service only | Increment happens server-side after a successful generation |
| `auth_attempts` | **never exposed** | service only | Reading it would leak account existence |
| `security_events` | **never exposed** | service only | Admin tooling only, and none exists yet |
| `email_log` | **never exposed** | service only | Contains recipients |

**Five of ten tables have no client-facing read path at all.** If a task adds one, that is a scope violation — escalate.

# 3 · FIELD-LEVEL

**Never returned in any response:**
```
users.password_hash
sessions.token_hash
verification_tokens.token_hash
```

Enforce in a repository-level serializer, not by remembering to omit them in each route. A single `toPublicUser()` function is the control; scattered `delete user.password_hash` calls are how leaks happen.

**Never accepted from a client:**
```
any user_id          profiles.completed_at
subscriptions.tier   oauth_accounts.provider_user_id
generation_quota.*
```

# 4 · WRITE PATTERNS

**Whitelist, never spread:**
```typescript
// WRONG — mass assignment; a client can set anything
await db.query('UPDATE profiles SET ... ', req.body);

// RIGHT
const { full_name, skills, target_role, experience_level } = validated;
```

**Parameterised queries only.** String interpolation into SQL is never acceptable, including for identifiers, `ORDER BY`, or `LIMIT`.

**Scope the UPDATE itself** — belt and braces:
```sql
UPDATE profiles SET full_name = $2 WHERE user_id = $1
```
Even if a bug supplies the wrong row, the `WHERE` clause bounds the damage.

# 5 · TRANSACTIONS

Required wherever multiple tables must agree:

| Operation | Tables |
|---|---|
| Signup | `users`, `profiles`, `subscriptions`, `generation_quota` |
| OAuth link | `oauth_accounts`, `users` (may null `password_hash` — L069) |
| Email change | `users`, `verification_tokens` |
| Account deletion | all, via cascade |

A partial write in the OAuth link leaves an account in an undefined credential state — a security bug, not just a data bug.

# 6 · CONNECTION SECURITY

- Credentials from `DATABASE_URL` only — never hardcoded, never committed
- TLS required in production
- **The application user is not a superuser.** It needs DML plus migration rights, nothing more
- Connection pooling with a bounded max — an unbounded pool is a denial-of-service vector against your own database
- **No production credentials in any developer or agent environment** (L064)

# 7 · WHAT LEAKS THROUGH ERRORS

A raw Postgres error tells an attacker your schema:

```
duplicate key value violates unique constraint "users_email_key"
```

That reveals the table, the column, and that the email exists. Catch constraint violations in the repository and translate them into generic service errors. The detail goes to server logs; the client gets "unable to process request".

This is also how the signup-enumeration leak (G6) reappears if you aren't careful.

# 8 · AUDIT

Emit a `security_events` row for: `password_invalidated_by_oauth_link` · `email_changed` · `oauth_linked` / `oauth_unlinked` · `permission_denied` · `otp_locked`.

**Never** put passwords, OTPs, tokens, or resume content in `metadata`.

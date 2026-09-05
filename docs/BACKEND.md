# BACKEND.md — Trackr

Next.js 16 API routes on Node 24 LTS, TypeScript. **Next.js *is* the backend** (L085) — no separate Express server.

---

# 1 · LAYERS

```
/app/api/*/route.ts      Route handler   — HTTP only
/lib/services/*.ts       Service         — business rules, transactions
/lib/repositories/*.ts   Repository      — SQL only
/lib/db.ts               Connection pool
```

**Route handler may:** parse and validate input, read session context, call one service, shape the response.
**Route handler may not:** contain business rules, write SQL, or call another route.

**Service may:** apply business rules, open transactions, orchestrate repositories, call the `AIProvider` interface.
**Service may not:** know about `Request`/`Response`, read cookies, or write SQL.

**Repository may:** execute SQL, map rows to types.
**Repository may not:** contain business rules or validation.

Skipping a layer is a scope violation — stop and escalate.

# 2 · FOLDER STRUCTURE

```
/app
  /api
    /auth/{signup,login,logout,session,verify,change-email}/route.ts
    /oauth/{google,linkedin}/{start,callback}/route.ts
    /profile/route.ts
    /profile/parse-resume/route.ts
    /subscription/route.ts
  /(app)          authenticated pages
  /(auth)         login, signup, verify
/lib
  /services       auth, profile, subscription, verification
  /repositories   user, profile, session, oauth, token, quota
  /ai             provider.ts (interface) · gemini.ts · claude.ts
  /email          transport.ts · templates/
  /security       session-middleware · rate-limit · csrf · headers · events
  /db.ts
  /env.ts         validated env access — never process.env directly
/migrations
/types
```

# 3 · MODULE BOUNDARIES

Modules communicate through service functions, never by importing each other's repositories.

```
auth → user, session, oauth, token repositories
profile → profile repository, AIProvider
subscription → subscription, quota repositories
```

If a service needs data from another module's tables, call that module's service. This is what makes the monolith modular (L017) — and what makes extraction possible later.

# 4 · THE AIProvider INTERFACE (L060)

```typescript
export interface AIProvider {
  extractProfile(pdf: Buffer): Promise<ExtractedProfile>;
  generateCoverLetter(profile: Profile, jd: string): Promise<string>;
  structureCallNote(answers: CallAnswers): Promise<StructuredNote>;
}
```

Services import the **interface**, never `@google/generative-ai`. One env var (`AI_PROVIDER`) selects the adapter. Switching providers means adding one file.

Every generated artifact records `provider` and `model` so output changes are traceable after a switch.

# 5 · ERROR HANDLING (A10 — L076)

```typescript
// WRONG — fails open
try { user = await resolveSession(req); } catch { /* continue */ }

// RIGHT — fails closed
try {
  user = await resolveSession(req);
} catch (err) {
  logSecurityEvent('session_resolution_failed', { err });
  return unauthorized();
}
```

Every catch in an auth path defaults to the restrictive branch. Client errors are generic; details stay in server logs.

# 6 · VALIDATION

Validate at the route boundary with an explicit schema. **Whitelist fields** — never spread a request body into a database write.

```typescript
// WRONG — mass assignment
await db.update('profiles', req.body);

// RIGHT
const { full_name, skills, target_role } = parsed;
```

# 7 · DATABASE ACCESS

`pg` with a connection pool. Parameterised queries only — string interpolation into SQL is never acceptable.

Transactions for any multi-table write (signup touches four tables; account linking touches two).

# 8 · CONVENTIONS

- `async`/`await`, never raw promise chains
- Named exports, no default exports outside route handlers
- Errors as typed results in services; throw only for genuinely exceptional cases
- No `any` — use `unknown` and narrow
- Env access only via `/lib/env.ts`, which validates at boot and fails fast

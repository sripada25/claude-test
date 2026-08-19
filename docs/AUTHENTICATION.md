# Authentication

Custom-built authentication on Node.js + Postgres — not Supabase Auth.
See [AGENTS.md](../AGENTS.md) §0, Decision 2 for why, and read the
tradeoff there before touching this file: this system owns its own
security surface. Nothing here is optional because "it's just an MVP."

## v1 scope

| Method | Status |
|---|---|
| Email + password | v1 |
| Google Sign-In (OIDC) | v1 |
| LinkedIn Sign-In (OIDC) | later, not v1 |
| Indeed | **OPEN DECISION** — see below, do not build |
| Naukri | **OPEN DECISION** — see below, do not build |

```
OPEN DECISION:
Does Indeed/Naukri provide an authorized Sign-In/SSO integration
Trackr can actually use? Required before implementation: official
developer documentation, partner/business program terms, confirmed
OAuth/OIDC availability, application approval process, and production
access requirements.

If no officially supported path exists: do not scrape Indeed/Naukri,
do not automate their login pages, do not collect user credentials for
them, and do not imitate their login UI. Mark the provider as
unsupported until an official integration exists.
```

## Provider abstraction

```
AuthProvider
  ├── LocalProvider     (email/password)
  ├── GoogleProvider    (OIDC)
  ├── LinkedInProvider  (later)
  └── IndeedProvider / NaukriProvider  (disabled — see OPEN DECISION)
```

The same underlying user account can have multiple login identities
attached:

```
users
  └── auth_identities
        ├── local    (email + password_hash)
        └── google   (google_sub)
```

Do not create a duplicate user automatically merely because someone
logged in through a different provider with a matching email — implement
account linking as an explicit, confirmed action, not an automatic
merge.

## Password security

- Hash with **Argon2id** through a maintained library (e.g. `argon2` /
  `node-argon2`, which wraps the reference Argon2 implementation). Never
  hand-write password hashing.
- Unique salt per password (the library handles this automatically —
  never implement salting manually).
- Password strength check at registration.
- Rate limiting on login and password-reset endpoints.
- Password-reset tokens: short-lived, one-time-use.
- Never log a password. Never return one in an API response or error
  message, even in development.
- Never store passwords in plaintext or with reversible encryption —
  hashing only.

## Session and token strategy

Sessions, not JWTs. JWTs are not being introduced here merely because
they are popular — this is a traditional server-rendered-cookie
architecture (browser + mobile app talking to one backend), and sessions
are the simpler, more revocable fit.

- Session cookie: `HttpOnly`, `Secure`, `SameSite` (value chosen per
  environment — see `docs/DEPLOYMENT.md`)
- Session store: Postgres-backed (e.g. `connect-pg-simple`), so sessions
  survive a backend restart without adding a new infrastructure
  dependency like Redis
- Never put a long-lived authentication secret in `localStorage`,
  `sessionStorage`, a URL, a query string, application logs, or frontend
  source code

The mobile app authenticates against the same backend and the same
session mechanism — it is not a separate auth system with its own
token scheme.

## Google Sign-In

Use Google's current OAuth 2.0 / OpenID Connect implementation via a
spec-compliant OIDC client library (e.g. `openid-client`) rather than a
loose OAuth wrapper — the requirement is OIDC specifically, not just
"OAuth that happens to work with Google."

Required environments, each with its own redirect URI: `local`,
`staging`, `production`. Do not reuse production OAuth credentials for
local development. Never commit `GOOGLE_CLIENT_SECRET` — see
`docs/ENVIRONMENT.md`.

## Authorization

- Every protected API endpoint verifies authorization on the backend —
  never trust a frontend role check
- Users cannot access another user's records by changing an ID in the
  URL or body — every query is scoped to the authenticated user unless
  the endpoint is explicitly an admin endpoint
- Admin endpoints are protected independently, not by reusing the
  regular user-authorization check with a role flag alone
- Object-level authorization is tested, not assumed

## Security checklist (authentication-specific)

Run this before every production deployment — see the full list in
`docs/SECURITY.md`:

- [ ] Passwords are securely hashed (Argon2id)
- [ ] No plaintext credentials anywhere
- [ ] Sessions are securely managed (HttpOnly/Secure/SameSite, Postgres-backed)
- [ ] OAuth state/nonce protections are correctly implemented
- [ ] Redirect URIs are validated and environment-specific
- [ ] Password-reset tokens are short-lived and single-use
- [ ] Login and password-reset endpoints are rate-limited
- [ ] Account enumeration risk is considered (login/reset responses don't reveal whether an email exists)
- [ ] Account-linking logic is secure and explicit

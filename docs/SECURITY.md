# Security

## Baseline

OWASP Top 10:2025:

```
A01 Broken Access Control
A02 Security Misconfiguration
A03 Software Supply Chain Failures
A04 Cryptographic Failures
A05 Injection
A06 Insecure Design
A07 Authentication Failures
A08 Software or Data Integrity Failures
A09 Security Logging and Alerting Failures
A10 Mishandling of Exceptional Conditions
```

Also OWASP ASVS 5.0 as the deeper application-security verification
framework, for anything the Top 10 doesn't cover in enough detail.

## Validation checklist

Run before every production deployment — not once at launch, every
time.

**Authentication** — see `docs/AUTHENTICATION.md` for detail
- [ ] Passwords are securely hashed (Argon2id)
- [ ] No plaintext credentials exist anywhere
- [ ] Sessions are securely managed
- [ ] OAuth state/nonce protections are correctly implemented
- [ ] Redirect URIs are validated and environment-specific
- [ ] Password-reset tokens are short-lived
- [ ] Login endpoints are rate-limited
- [ ] Account enumeration risk is considered
- [ ] Account-linking logic is secure

**Authorization**
- [ ] Every protected API endpoint verifies authorization
- [ ] Users cannot access another user's records by changing an ID
- [ ] Role checks occur on the backend, never the frontend
- [ ] Admin endpoints are protected independently
- [ ] Object-level authorization is tested

**Input handling**
- [ ] Request bodies are schema-validated (Zod)
- [ ] Query parameters are validated
- [ ] IDs are validated (correct type/format before use in a query)
- [ ] File uploads, if present, are restricted (type, size, storage location)
- [ ] SQL injection is prevented (parameterized queries / Drizzle, never string-built SQL)
- [ ] Command injection is prevented (no shelling out to user input)
- [ ] XSS protections are present (React's default escaping is not a substitute for validating what gets rendered as raw HTML)
- [ ] SSRF risks are considered (any server-side fetch of a user-supplied URL)

**Browser / session security**
- [ ] HTTPS is enforced in production
- [ ] Cookies use appropriate security attributes (HttpOnly, Secure, SameSite)
- [ ] CORS is explicitly configured — not `*`
- [ ] CSRF protection is considered for cookie-based authentication
- [ ] Security headers are configured (CSP, X-Content-Type-Options, Referrer-Policy at minimum)
- [ ] Sensitive data is not exposed in URLs

**API security**
- [ ] Rate limits exist
- [ ] Request size limits exist
- [ ] Authentication errors do not leak whether an email/account exists
- [ ] Production stack traces are not exposed to clients
- [ ] Sensitive logs are redacted

**Database** — see `docs/DATABASE.md`
- [ ] Least-privilege database access is used
- [ ] Production database credentials are secret (env var, never committed)
- [ ] Database migrations are tracked
- [ ] Backups are considered
- [ ] Destructive migrations require explicit approval

**Dependency / supply chain**
- [ ] Dependencies are audited (`npm audit` or equivalent in CI)
- [ ] Lock files are committed
- [ ] Known critical vulnerabilities are reviewed before merge
- [ ] Unnecessary dependencies are removed
- [ ] Package install scripts are reviewed before adding a new dependency

**Payments** — see `docs/PAYMENTS.md`
- [ ] Server verifies payment status
- [ ] Payment signatures/webhooks are verified
- [ ] Webhooks are idempotent
- [ ] Client cannot choose an arbitrary payment amount
- [ ] Refund behaviour is explicitly defined

## Error handling

Never expose internal exceptions directly to users.

Development may show detailed diagnostics. Production returns a safe,
generic shape:

```json
{
  "error": {
    "code": "INVALID_REQUEST",
    "message": "The request could not be processed."
  }
}
```

Never return, in a production error response: database stack traces,
raw SQL, filesystem paths, secret names, OAuth client secrets, or
internal service details.

## Logging

Implement structured application logging (e.g. `pino`, with redaction
for known-sensitive fields).

**Never log:** passwords, session tokens, OAuth secrets, payment
secrets, database passwords, full authentication headers.

**Do log** (as security-relevant events, with a correlation/request ID
where practical): login success/failure, password-reset request,
password change, account lockout, OAuth login, account linking, payment
creation, payment success/failure, webhook receipt, authorization
denial, admin actions.

## Secrets policy

Must never appear in: source code, git history, issue comments, pull
requests, screenshots, logs, test fixtures, frontend JavaScript bundles,
or database records unless specifically required and encrypted.

Examples: passwords, API keys, OAuth secrets, payment secrets, database
passwords, session secrets, private certificates, production tokens.

An AI coding agent must never ask a human to paste a production secret
into chat — use the environment variable / secret store instead. See
`docs/ENVIRONMENT.md`.

## CI as an additional layer, not the only control

Automated security tooling (dependency scanning, secret scanning, SAST)
supplements human review — it does not replace it. Treat any automated
security workflow carefully around what it has permission to touch and
what it can be tricked into doing by untrusted input (e.g. a malicious
PR description) — keep its permissions minimal.

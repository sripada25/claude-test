# P9-IMPLEMENTATION.md — Trust proxy and operations tasks

Full implementation notes. Both were disputed as premature; both are confirmed in scope.

---

# T7.5 — TRUST PROXY HANDLING

## What the problem actually is

Your app runs behind a **reverse proxy** — Railway's edge, or a VPS's nginx/Caddy. The proxy receives every request from the internet and forwards it to your container over an internal connection.

**The consequence:** at the TCP layer, every request now originates from the proxy's IP, not the real client's. If your code reads the socket's remote address, it reads the **proxy**, always the same value, for every single request.

```
Attacker  →  Proxy (203.0.113.1)  →  Your app
User A    →  Proxy (203.0.113.1)  →  Your app
User B    →  Proxy (203.0.113.1)  →  Your app
```

**Why this breaks the rate limiter specifically:** T2.4's brute-force protection keys on client IP (`SECURITY_quarterfinal.md` §8, `auth_attempts.identifier`). If every request appears to come from `203.0.113.1`, the limiter can't distinguish an attacker from a legitimate user — one of two failures happens:

- Block after N failures **total**, and one attacker locks out every real user sharing that apparent IP
- Or the limiter is set generously to avoid that, and now it barely limits anyone

Neither is a working rate limiter.

## The fix — and its own danger

Proxies conventionally add a header naming the original client:

```
X-Forwarded-For: 198.51.100.7, 203.0.113.1
                  ↑ original client    ↑ each hop that touched it
```

The **first** entry is the original client, if you trust the chain wrote it correctly.

**⚠️ This header is also the danger.** Nothing stops a client from sending their own `X-Forwarded-For` in the original request. If your app reads it unconditionally, an attacker sets `X-Forwarded-For: 1.2.3.4` and appears to be a different client on every request — the rate limiter never accumulates failures against them.

**So the header is only trustworthy when a proxy you control is guaranteed to be in front, overwriting or appending to it before your app sees it.**

## The implementation

```typescript
// lib/security/client-ip.ts

export function getClientIp(req: Request): string {
  const trustProxy = process.env.TRUST_PROXY === 'true';

  if (!trustProxy) {
    // No proxy in front. Read the real socket address.
    // Any X-Forwarded-For here is attacker-supplied — ignore it entirely.
    return req.socket.remoteAddress ?? 'unknown';
  }

  // A proxy IS in front, and it is configured to set this header
  // reliably (overwriting anything the client sent, appending its own hop).
  const forwarded = req.headers.get('x-forwarded-for');
  if (!forwarded) {
    // Proxy should always set this. Its absence is suspicious — fail safe.
    return 'unknown';
  }

  // First entry is the original client.
  return forwarded.split(',')[0].trim();
}
```

**Used everywhere client IP matters:**
- T2.4 rate limiter — `auth_attempts.identifier`
- `security_events.ip`
- `sessions.ip`

## The environment split

| | `TRUST_PROXY` | Behaviour |
|---|---|---|
| **Local** | `false` | Read `req.socket.remoteAddress` directly — no proxy exists |
| **Railway** | `true` | Railway's edge always sets `X-Forwarded-For` correctly, overwriting client-supplied values |
| **VPS + Caddy/nginx** | `true` | **Only if you've confirmed the proxy config strips/overwrites client-supplied `X-Forwarded-For`** — this is not automatic, it must be configured |

⚠️ **This is the one control in the entire security model that requires different code behaviour, not just different config values** (`SECURITY_quarterfinal.md` §20). Every other gap is identical logic with a different environment variable; this one branches.

## Why it can't be verified locally

There's no proxy on your laptop. `TRUST_PROXY=false` locally means the code path that reads `X-Forwarded-For` never executes in development — it's genuinely new territory the first time you deploy.

## Verification checklist — post-deploy only

```
1. Deploy with TRUST_PROXY=true
2. Trigger a rate-limited endpoint (e.g. 3 bad logins) from your own IP
3. Check security_events.ip — does it show YOUR real IP, or the proxy's?
4. If it shows the proxy's IP (same for every request): TRUST_PROXY isn't
   working, or the platform doesn't set X-Forwarded-For as expected —
   STOP, the rate limiter is not functioning
5. Attempt to spoof: send a login request with your own
   X-Forwarded-For: 1.1.1.1 header. Confirm the logged IP is still yours,
   not 1.1.1.1 — proves the proxy is overwriting, not appending blindly
```

**Step 5 is the one people skip and regret.** It's the difference between "the header works" and "the header can't be forged."

## Acceptance criteria

- [ ] `TRUST_PROXY=false` locally reads the socket address, never the header
- [ ] `TRUST_PROXY=true` reads `X-Forwarded-For`, first entry
- [ ] Absence of the header when `TRUST_PROXY=true` fails safe (`'unknown'`, still rate-limited as one bucket — not silently unlimited)
- [ ] Spoofing test (step 5 above) passes post-deploy
- [ ] `security_events.ip`, `sessions.ip`, and `auth_attempts.identifier` all use this single function — no second implementation

## Database impact

None — reads existing columns (`security_events.ip`, `sessions.ip` in `DATABASE_quarterfinal.md` §2.3, §2.7). No migration.

**References:** T2.4 · `SECURITY_quarterfinal.md` §17.2 · L076

---
---

# P9 — OPERATIONS

Four tasks. Each is genuinely deferred-in-effect but specified now, per your instruction — the notes exist so nothing is invented at implementation time, even though the actual coding happens closer to deployment.

---

## T9.1 — Health endpoint

### What it's for

Hosting platforms poll a URL after deploying your container to decide whether the new version is actually running before routing traffic to it. Without one, Railway (or any platform) either can't tell if your deploy succeeded, or falls back to checking that *any* port responds — which says nothing about whether your app can actually serve requests.

### Why it must not touch the database

If the health check queries Postgres and the database is briefly slow, the platform sees a failed health check and may **restart your container** — the fix for a slow-but-working database becomes a full app restart, which is strictly worse.

### Implementation

```typescript
// app/api/health/route.ts
export async function GET() {
  return Response.json({ status: 'ok', timestamp: new Date().toISOString() });
}
```

That's genuinely the whole endpoint. No auth, no DB, no dependencies checked.

**If you later want a *deep* health check** (verifying DB connectivity) for your own monitoring, that's a **separate** endpoint (`/api/health/deep`) — never the one the platform polls for restart decisions.

### Acceptance criteria

- [ ] `GET /api/health` returns 200 with zero dependencies
- [ ] Responds in under 50ms under normal load
- [ ] Never returns non-200 due to database, email provider, or AI provider state
- [ ] Not authenticated — the platform's poller has no session

### Database impact

None, by design.

**References:** `SECURITY_quarterfinal.md` §17.1 · `PLATFORM.md`

---

## T9.2 — Nightly backup job

### What it's for

`pg_dump` piped to Cloudflare R2 nightly (L026). The escape hatch that makes L025's portability promise real — if you ever need to leave Railway, you have a provider-independent snapshot.

### Why it runs inside the app container

Railway databases are private by default. Exposing one for an external dump tool creates a public TCP proxy and incurs egress billing — putting the database on the internet to back it up. Running the job from inside the existing app container uses private networking: no new service (preserving L030's one-service rule), no exposure, no egress charge (L089).

### Implementation

```typescript
// lib/ops/backup.ts
import { exec } from 'node:child_process';
import { promisify } from 'node:util';
const execAsync = promisify(exec);

export async function runNightlyBackup() {
  const timestamp = new Date().toISOString().slice(0, 10);
  const filename = `backup-${timestamp}.sql.gz`;

  // pg_dump reads DATABASE_URL directly — no separate credential handling
  await execAsync(`pg_dump "${process.env.DATABASE_URL}" | gzip > /tmp/${filename}`);

  await uploadToR2(`/tmp/${filename}`, `backups/${filename}`);

  await fs.unlink(`/tmp/${filename}`);  // never leave the dump on local disk
}
```

**Scheduling:** an in-process cron (`node-cron` or equivalent) running inside the same container — not a platform cron add-on, which would be a second billed service.

### Rehearse the restore — not optional

**A backup that has never been restored is not a backup.** Before relying on this, do one full restore against a scratch Postgres instance and confirm the data matches. This is a manual verification step, done once before launch, not part of the automated job.

### Acceptance criteria

- [ ] Runs nightly, in-container, no new Railway service
- [ ] Dump file deleted from local disk after upload — never persists in the container
- [ ] Failure is logged to `security_events` (or a dedicated ops log) and does **not** crash the app
- [ ] A restore has been manually rehearsed once against a scratch database
- [ ] R2 credentials come from env vars, never hardcoded

### Database impact

Reads the entire database via `pg_dump`. No schema change.

**References:** L026 · L089 · L030 · L025 · `DATABASE_quarterfinal.md` §7

---

## T9.3 — Env validation at boot

### What it's for

A missing or malformed environment variable should crash the app **the moment it starts**, not surface as a 500 error the first time a user hits the code path that needs it. The difference is: catching it in a deploy log versus catching it via a user's bug report.

### Implementation

```typescript
// lib/env.ts — read by every other module, never process.env directly
import { z } from 'zod';

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'production']),
  DATABASE_URL: z.string().url(),
  SESSION_SECRET: z.string().min(32),
  AI_PROVIDER: z.enum(['gemini']),
  GEMINI_API_KEY: z.string().min(1),
  EMAIL_TRANSPORT: z.enum(['mailpit', 'brevo']),
  TRUST_PROXY: z.enum(['true', 'false']),
  NEXT_PUBLIC_APP_URL: z.string().url(),
  // ... every required var, exhaustively
});

export const env = envSchema.parse(process.env);
// .parse() throws immediately on any missing/invalid value —
// the import itself fails, so nothing in the app can run without it
```

**Every other file imports `env` from here** — never `process.env.WHATEVER` scattered through the codebase. One place validates; every consumer trusts it's already valid.

### Acceptance criteria

- [ ] App fails to boot (non-zero exit) if any required var is missing or malformed
- [ ] The error names exactly which variable and why
- [ ] No file in the codebase reads `process.env` directly outside `lib/env.ts`
- [ ] `.env.example` stays in sync with the schema — every schema key has a documented example

### Database impact

None.

**References:** `BACKEND.md` §8 · `PLATFORM.md` §4

---

## T9.4 — Expired-row sweep

### What it's for

Three tables grow on every authentication event and never shrink without this: `oauth_states` (every OAuth attempt), `verification_tokens` (every OTP), `auth_attempts` (every login attempt, successful or not). Left alone, they grow indefinitely — slower queries, larger backups, no functional benefit from the old rows.

### Why it's not urgent but is real

At zero users these tables are empty. The task is genuinely low-priority *today*. But it isn't speculative — the tables exist now (`DATABASE_quarterfinal.md` §2.4, §2.5, §2.7) and will grow from the first login attempt. Better specified now than discovered as a slow query in six months.

### Implementation

```sql
-- run daily, in-container, same job scheduler as the backup

DELETE FROM oauth_states WHERE expires_at < now();

DELETE FROM verification_tokens
  WHERE expires_at < now() - interval '7 days';  -- keep a short tail for support lookups

DELETE FROM auth_attempts
  WHERE created_at < now() - interval '90 days';  -- retention window, see below
```

**Retention window (90 days for `auth_attempts`):** long enough to investigate an incident discovered weeks later, short enough to bound table growth. **This number is a placeholder pending your confirmation** — `DATABASE_quarterfinal.md` §11 flags it as open.

⚠️ **`security_events` is deliberately NOT swept here.** It's the forensic record (`SECURITY_quarterfinal.md` §10) — retained separately, on a longer or indefinite window, because it's what you'd need for a breach investigation.

### Acceptance criteria

- [ ] Runs daily, in-container
- [ ] `oauth_states`: deletes anything past `expires_at`
- [ ] `verification_tokens`: deletes anything older than 7 days past expiry
- [ ] `auth_attempts`: deletes anything older than the confirmed retention window
- [ ] `security_events` is explicitly excluded — verified by a test that inserts an old row and confirms the sweep leaves it
- [ ] Sweep failure is logged, does not crash the app

### Database impact

Deletes from `oauth_states`, `verification_tokens`, `auth_attempts`. No schema change. No cascade concerns — none of these are referenced by other tables' foreign keys in a way that requires ordering.

**References:** `DATABASE_quarterfinal.md` §2.4, §2.5, §2.7, §11

---
---

# SUMMARY — where these land

| Task | Group | Env | Why it stays |
|---|---|---|---|
| T7.5 | P2 (Auth core) | 🌐 deploy-only | Your instruction — needed, own task, not folded |
| T9.1 | P9 (Operations) | 🌐 deploy-only | Your instruction — full notes required regardless of build timing |
| T9.2 | P9 (Operations) | 🌐 deploy-only | Same |
| T9.3 | P9 (Operations) | ✅ local-complete | Same — this one actually runs locally too |
| T9.4 | P9 (Operations) | ✅ local-complete | Same |

**Both `TASKS.md` and `TASKS-2026-08-26-v2.md` already list all five** — the dispute was never about their presence in those files, only about whether they were premature. That question is now closed: they stay, fully specified.

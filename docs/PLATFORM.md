# PLATFORM.md — Trackr

Local and production run the **same Docker image**. They differ only by environment variables (L067).

---

# 1 · PRINCIPLE

> If you write `if (isLocal)` around business logic, that is a bug.

The only legitimate environment branches in the entire codebase:

| What | Derived from |
|---|---|
| `Secure` cookie flag | `NODE_ENV` |
| `__Host-` cookie prefix | `NODE_ENV` |
| HSTS header | `NODE_ENV` |

Everything else is an env var. **Never hardcode `localhost`.**

# 2 · LOCAL STACK

```
docker compose up -d                      DAILY
  ├─ postgres   :5432   pinned 16, data volume
  └─ mailpit    :1025 SMTP · :8025 web UI
  (app on host: npm run dev → :3000)

docker compose --profile full up --build  BEFORE DEPLOY
  └─ + app      :3000   production container from the Dockerfile
```

**Why the app isn't containerised for daily work:** hot reload through a volume
mount is slow and unreliable on Mac and Windows — file-change events get missed
and rebuilds take seconds instead of milliseconds. You'd fight the tooling for
no gain, since the artifact that must be reproducible is the *production* image,
and that's built from the same Dockerfile either way.

**Why Postgres and Mailpit always are:** they're dependencies, not your code.
Pinned, disposable, identical to production. You never edit them, so there's no
hot-reload cost to pay.

⚠️ **Service names, not `localhost`.** Inside the Docker network `localhost` is
the container itself. The app reaches Postgres at `postgres:5432`. Running the
app on your host, it's `localhost:5432`. Both are configured; the difference
catches everyone once.

**Mailpit, not console logging** (L072). Real SMTP means the send path is genuinely exercised; you read the mail at `localhost:8025`. Console logging skips the code you most need to test.

# 3 · POSTGRES VERSION — 16 EVERYWHERE

**Local and Railway both run PostgreSQL 16.** Resolved from Railway's docs (L088).

Railway's Postgres plugin offers 14, 15, 16 and 17 at provisioning, defaulting to 16.
Accept the default; `docker-compose.yml` pins `postgres:16-alpine` to match.

Confirm after provisioning:
```sql
SELECT version();
```

If it ever reports something other than 16, stop and reconcile before running
migrations — silent differences in JSON handling and index behaviour are exactly
the class of bug that surfaces only in production.

# 4 · ENVIRONMENT VARIABLES

| Variable | Local | Production |
|---|---|---|
| `NODE_ENV` | `development` | `production` |
| `DATABASE_URL` | docker-compose | injected by host |
| `SESSION_SECRET` | `openssl rand -base64 32` | different value |
| `AI_PROVIDER` | `gemini` | `gemini` |
| `GEMINI_API_KEY` | free tier | **paid tier** (L057) |
| `EMAIL_TRANSPORT` | `mailpit` | `brevo` |
| `BREVO_API_KEY` | — | real |
| `GOOGLE_CLIENT_ID` / `_SECRET` | dev OAuth app | production OAuth app |
| `NEXT_PUBLIC_APP_URL` | `http://localhost:3000` | real domain |
| `STRIPE_SECRET_KEY` | test mode | live |
| `R2_*` | blank until needed | real |

Validate every variable at boot in `/lib/env.ts`. **Fail fast** — a missing secret should crash at startup, not surface as a 500 during a user's signup.

# 5 · OAUTH REDIRECT URIS

Google permits `http://localhost` redirect URIs — no HTTPS or public domain needed for development.

Register **both**, don't swap:
```
http://localhost:3000/api/oauth/google/callback
https://<production-domain>/api/oauth/google/callback
```

LinkedIn requires byte-for-byte matching including scheme and trailing path. Hold Google to the same standard.

⚠️ LinkedIn additionally requires a verified **company Page** to create the app at all (L074) — this blocks local testing too, not just production.

# 6 · PAYMENT WEBHOOKS LOCALLY

```bash
stripe listen --forward-to localhost:3000/api/webhooks/stripe
```

Forwards real Stripe events to your machine. Razorpay has no equivalent CLI — use a tunnel (`cloudflared` or `ngrok`) and register the tunnel URL as the webhook endpoint.

Local webhook testing is fully viable. Test mode covers success, failure, and duplicate delivery.

# 7 · DEPLOY

> Full pre-deploy, deploy, and post-deploy checklists — plus the container
> contract and the trust-proxy rule — are in **`SECURITY-CONTROLS.md` §12**.

1. Push to the repository
2. Host detects the `Dockerfile` and builds (L043 — a Dockerfile takes priority over any platform default builder and keeps the build portable)
3. Provision Postgres, set env vars
4. Run migrations
5. Add the production OAuth redirect URI

**No code changes.** If a deploy requires editing a file, something violated §1.

# 8 · WHAT ONLY EXISTS IN PRODUCTION

| | Note |
|---|---|
| TLS certificate | Host terminates; nothing local to get wrong |
| Email deliverability | SPF/DKIM/DMARC — **the one to watch**, since L038 Option B is exactly the pattern that lands in spam if DKIM is misaligned |
| **Proxy headers** | Client IP arrives in `X-Forwarded-For`. **Make this configurable from day one** — otherwise the rate limiter counts every attacker as one IP |
| Concurrency | Connection pool and rate limits under real load |

Three of these four require no code. The proxy-header one does — build it configurable now.

# 9 · STAGING

Production and staging are the same thing for now (D5). Env-var design supports a third environment without code changes when you want one.

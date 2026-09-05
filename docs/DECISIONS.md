# Trackr — Decision Ledger v3

Two zoom levels in one document:
**Part 1** — scan the whole project in 60 seconds.
**Part 2** — full records for decisions with history worth keeping.

Verbatim exchanges live in `./sessions/`. Feature detail lives in `FEATURE-A-SPEC.md`.

```
docs/
  DECISIONS.md              ← this file
  FEATURE-A-SPEC.md         ← F1 technical spec
  sessions/
    2026-08-23-stack.md     ← frozen
    2026-08-24-feature-a.md ← frozen
```

---

# PART 1 — AT A GLANCE

## Architecture & stack

| ID | Decision | Status |
|----|----------|--------|
| L017 | Modular monolith, single deployable | ✅ |
| L018 | All logic behind JSON APIs; web + mobile are peer clients | ✅ |
| L020 | React + TypeScript + Tailwind, no component library; web first | ✅ |
| L021 | Next.js 16 · Node 24 LTS · builder = Railpack (L021a) | ✅ |
| L043 | Dockerfile at repo root — portable build | ✅ |
| L030 | Excluded: Kubernetes, Redis, microservices, managed DB, multi-service | ✅ |

## Hosting, data & portability

| ID | Decision | Status |
|----|----------|--------|
| L019 | Railway Hobby — **deferred**, see L067 | ⏸ |
| L022 | Postgres (standard PG — `pg_dump` portable) | ✅ |
| L023 | Supabase rejected | ✅ |
| L025 | **Free, complete DB portability — standing requirement** | 🔒 |
| L026 | Backups: nightly `pg_dump` → R2 | ✅ |
| L088 | **PostgreSQL 16 in both environments** — Railway's provisioning default | ✅ NEW |
| L089 | **Backup job runs INSIDE the app container**, not as a separate service | ✅ NEW |
| L027 | Document storage: Cloudflare R2 | ✅ |
| L028 | Text canonical in Postgres; PDF client-rendered; R2 on explicit save | ✅ |
| L062 | Free tier: view/copy only · Pro: PDF download | ✅ |
| L067 | **Develop locally first; deploy later** | ✅ NEW |

## Identity & access

| ID | Decision | Status |
|----|----------|--------|
| L039 | Self-built auth — Argon2id + server-side sessions | ✅ |
| L044 | httpOnly cookie + `sessions` table, not JWT | ✅ |
| L052 | Password: min 12 chars, no complexity rules | ✅ |
| L068 | **SSO added: Google (MVP) + LinkedIn (after Page exists)** | ✅ NEW |
| L069 | **Account linking: auto-link on verified email, invalidate unverified password** | ✅ NEW |
| L070 | **SSO-only users can set a password — never strand a user** | ✅ NEW |
| L071 | **Verification by OTP, not magic link** | ✅ NEW |
| L040 | Verification required — gates first AI generation | ✅ |
| L041 | Timezone captured at signup | ✅ |
| L050 | Two emails: `users.email` (login) vs `profiles.contact_email` (Reply-To) | ✅ |
| L051 | Email changeable, with re-verification | ✅ |

## Profile & AI

| ID | Decision | Status |
|----|----------|--------|
| L045 | Skills as `text[]`, lowercase-normalized | ✅ |
| L046 | `experience_level` enum: junior/mid/senior/lead | ✅ |
| L047 | Profile mandatory before app access | ✅ |
| L048→L061 | **Revised** — PDF straight to Gemini, no `pdf-parse` | ✅ |
| L049 | Parse output never saved blind — review mandatory | ✅ |
| L060 | Provider-agnostic `AIProvider` interface | ✅ |
| L057 | Gemini **paid** tier before first real user (privacy) | ⚠️ |
| L059 | Free tier during local development only | ✅ |
| L058 | AI budget ~$10–30/month at MVP scale | ✅ |

## Follow-up, email & payments

| ID | Decision | Status |
|----|----------|--------|
| L038 | Free = draft+copy · Pro = send via Brevo with `Reply-To` | ✅ |
| L054 | Drafting free, sending Pro | ✅ |
| L055 | Follow-up drafts don't consume generation quota | ✅ |
| L029 | Email provider: Brevo | ⚠️ confirm |
| L072 | **Local email: Mailpit (real SMTP), not console logging** | ✅ NEW |
| L073 | **Payments developed locally — Stripe CLI + tunnel for webhooks** | ✅ NEW |
| L036 | Own send-queue required (reminders cluster; Brevo caps at 300/day) | ✅ |

## Privacy & workflow

| ID | Decision | Status |
|----|----------|--------|
| L064 | Data minimization baseline | 🔒 |
| L065 | ⚠️ Free tier vs "maximum privacy" — unresolved tension | ⚠️ |
| L015 | Allow-list scoping + version-pinned approval | ✅ |
| L016 | Ledger updated only on explicit approval | ✅ |
| L053 | PRD Phase 0 does not gate the build | ✅ |

## Sizing — canonical, do not re-derive

| ID | Conclusion |
|----|-----------|
| L031 | ~200 KB DB growth per user per month |
| L032 | 1,000 users / 12 months → ~3.4 GB Postgres |
| L033 | 1,000 users → ~2.5 writes/min, ~9 reads/min (~0.05% of a small instance) |
| L034 | **Compute isn't the constraint — Gemini's per-minute burst is** |
| L035 | ~30 emails/user/month → Brevo free tier ≈ 300 users |

## 🔴 Open

| ID | Question | Blocks |
|----|----------|--------|
| L066 | Verify real Gemini quota in AI Studio console | F3, F4, F5 |
| L029 | Confirm Brevo | F4 |
| L074 | **Create LinkedIn company Page — required to create the app at all** | LinkedIn SSO |
| L082 | **Should Google profile claims (name, photo) pre-fill the profile?** Free data, less friction — but more personal data pulled in | F1 |

## Security — OWASP Top 10:2025 (added 2026-08-25)

| ID | Decision | Status |
|----|----------|--------|
| L075 | **OAuth `state` + PKCE required** — without `state`, an attacker can link a victim's session to their own Google account | 🔴 NEW |
| L076 | **Fail closed everywhere** (A10, new category) — middleware exception ⇒ deny · DB down ⇒ 503 · rate limiter down ⇒ deny · AI timeout ⇒ no quota decrement, no partial save | 🔴 NEW |
| L077 | **Supply chain** (A03, new category) — `npm ci` only · lockfile committed · verify packages exist before adding (slopsquatting) · base images pinned by digest · Dependabot on | 🔴 NEW |
| L078 | **Security headers** (A02, now #2) — CSP, HSTS (prod), nosniff, Referrer-Policy, Permissions-Policy; no stack traces to clients | 🔴 NEW |
| L079 | **Signup must not leak account existence** — same response either way + notify the existing address | 🟠 NEW |
| L080 | **`security_events` table** (A09) — failed logins, OAuth password invalidation, email changes, OTP lockouts, rate-limit trips. Logging without alerting has minimal value. | 🟠 NEW |
| L081 | **SSRF decision deferred to F2** — `source_url` must never be fetched server-side, or private IP ranges blocked. SSRF is now folded into A01. | 🟡 NEW |
| L083 | **Cookies:** `httpOnly` + `SameSite=Lax` always · `Secure` and `__Host-` prefix gated on `NODE_ENV` · **never `Strict`** (breaks OAuth callback) | ✅ NEW |

## Tooling & workflow (added 2026-08-25)

| ID | Decision | Status |
|----|----------|--------|
| L084 | **Execution moves to Claude Code.** This interface has no repo access — no branches, PRs, or hooks. Architecture happens here; implementation happens there. | ✅ NEW |
| L085 | **Next.js *is* the Node app.** Node 24 LTS is the runtime; no separate Express server. One process, one container. | ✅ NEW |
| L086 | **Document set consolidated 12 → 7** — `CLAUDE.md`, `ARCHITECTURE.md`, `SECURITY.md`, `TESTING.md`, `TASKS.md`, `DECISIONS.md`, `FEATURE-A-SPEC.md`. Reports are per-PR, not standing docs. | ✅ NEW |
| L087 | **MCP does not reduce token consumption** — it adds capability; each call costs tokens. Scoped context is the actual lever (§24, §37). | ✅ NEW |

## Superseded

| ID | Was | Now |
|----|-----|-----|
| L002 | Android MVP first | L020 — web first |
| L012 | React Native + Expo | L020 — React web |
| L007 | "Gemini free tier sufficient" | L034 — burst limit is the real constraint |
| L021 | Nixpacks | L021a — Railpack |
| L048 | `pdf-parse` → Gemini | L061 — PDF straight to Gemini |
| L024 | Auth self-built (inferred) | L039 — confirmed |

---
---

# PART 2 — DECISION RECORDS

Only decisions with history worth keeping. Settled-on-first-pass items live in Part 1 alone.

---

### L088 — PostgreSQL version

1. **Initially stated:** *"we can verify with its documentation. so do that and tell me."* — after I claimed the check was impossible without Railway access.
2. **What changed:** it wasn't impossible. Railway's docs answer it directly: the Postgres plugin offers 14, 15, 16 and 17 at provisioning, **defaulting to 16**. My earlier advice to pin 17 locally was arbitrary — it would have required remembering to override the default on deploy day.
3. **Going with:** **PostgreSQL 16 in both environments.** `docker-compose.yml` pins `postgres:16-alpine`; accept Railway's default at provisioning. Confirm with `SELECT version();` after provisioning.
4. **Could change if:** a future feature needs a 17-only capability — nothing in F1–F6 does. At ~0.05% utilisation (L033), version-level performance differences are irrelevant here.

`2026-08-25` · Approved · **Corrects my "impossible to check" claim**

---

### L089 — Backup job placement

1. **Initially stated:** L026 — nightly `pg_dump` → R2, treated as a solved problem.
2. **What changed:** Railway databases are **private by default**; exposing one creates a TCP Proxy and incurs **network egress billing**. So an external dump either costs money and exposes the database to the internet, or needs a second Railway service — which contradicts L030's one-service rule.
3. **Going with:** the backup job runs **inside the existing app container** on a schedule, connecting over private networking via `DATABASE_URL`, streaming to R2. No extra service, no egress charge, no public exposure. Railway's native Backups feature is a useful complement, but being platform-specific it doesn't satisfy L025 — `pg_dump` → R2 remains the portable escape hatch.
4. **Could change if:** backup duration starts affecting request latency in the shared container → move to a dedicated service and accept the cost.

`2026-08-25` · Approved · **Closes a gap in L026**

---

### L017 — Application architecture

1. **Initially stated:** *"monolithic approach is easy at start but once users increase i or other again need to rework from scratch… complete rework on architecture is required"*
2. **What changed:** the rewrite risk was misdiagnosed. What actually forces rewrites is business logic tangled into UI, no stable API boundary, and no migration discipline — none of which are caused by a monolith. Shopify and GitHub run monoliths at scale.
3. **Going with:** modular monolith, single deployable, clean internal module boundaries.
4. **Could change if:** one module becomes a genuine measured bottleneck → extract that module alone (~2 weeks, not a rewrite).

`S-04` · Approved · Never revised

---

### L023 / L039 — Supabase → self-built auth

1. **Initially stated:** *"supabase is coming with authentication"* — considered for the free auth.
2. **What changed:** Supabase stores identity in its own `auth` schema. That's the one thing `pg_dump` can't cleanly move — a direct conflict with L025, which you'd stated as a hard requirement in the same message.
3. **Going with:** self-built auth on plain Postgres. Argon2id, httpOnly cookies, server-side `sessions` table. Confirmed explicitly (was inferred as L024, now retired).
4. **Could change if:** portability stops being a requirement — unlikely, it's marked standing.

`S-09`, `S-17` · Approved

---

### L021 → L021a — Build system

1. **Initially stated:** *"Nextjs supported by railway? do we need to explicitly install it?"*
2. **What changed:** answered "yes, Nixpacks auto-detects." **You corrected me** — Railway moved to Railpack on 2026-03-04; Nixpacks is in maintenance mode. Verified.
3. **Going with:** Railpack is the platform default, but **L043 puts a Dockerfile at repo root**, which takes priority and keeps the build portable per L025.
4. **Could change if:** never meaningfully — a Dockerfile is platform-independent by construction.

`S-08`, `S-15` · Approved · **Revised once — my information was stale**

---

### L047 / L048 → L061 — Profile creation & resume parsing

1. **Initially stated:** *"user must complete his profile via manually filling the form or just uploading the resume… auto filling the form using ai or a script. I wonder ai is costly rather than going with a script."*
2. **What changed — twice:**
   - **Cost reasoning was inverted.** Parsing runs *once per user, ever* (~1,000 calls at 1,000 users); generation runs ~5,000/month. Parsing is a rounding error; a script would cost weeks and deliver 40–60% accuracy.
   - **Then you mentioned screenshot-in-PDF resumes** — which killed my own recommendation. Gemini reads PDFs with native vision, handling scans and images directly. The `pdf-parse` step was unnecessary complexity.
3. **Going with:** signup → profile (manual **or** resume upload) → mandatory review → complete → app access. PDF goes straight to the AI provider. Native text tokens aren't billed; image pages cost 258 tokens (~$0.00015 for a 2-page scan).
4. **Could change if:** accuracy proves poor on real resumes → add a deterministic pre-pass. The mandatory review step (L049) makes this low-risk either way.

`S-19`, `S-23` · Approved · **Revised once — your domain knowledge simplified the design**

---

### L038 / L054 / L055 — Follow-up email delivery

1. **Initially stated:** *"Yes app sends notifications when required"* — ambiguous between notifying the user and emailing recruiters.
2. **What changed:** three options surfaced with very different costs. I also **overstated Option C** — `gmail.send` is a *sensitive* scope needing review and a demo video, not a *restricted* scope needing an annual security assessment (logged as L056).
3. **Going with:** **A** (draft + copy) free · **B** (Brevo send, `Reply-To:` = `contact_email`) Pro · **C** rejected for MVP — the PRD's value is the drafting, not the transport. Drafts don't consume generation quota.
4. **Could change if:** users object to the sender domain, or deliverability suffers → revisit C, now known to be cheaper than first stated.

`S-14`, `S-21`, `S-22` · Approved · **Revised once — my error, corrected**

---

### L057 / L059 / L065 — Gemini tier & the privacy tension

1. **Initially stated:** *"as of initial mvp which still not yet have any real users, lets stick with free tier"* — plus, separately, *"maximum data privacy."*
2. **What changed:** Google's free tier trains on submitted prompts; the paid tier doesn't. Trackr sends resumes — name, phone, address, employment history. That contradicts the PRD's own *Deliberately never* clause: *"Telemetry on application content — User data is private."* Separately, free quotas were cut 50–80% in December 2025 and Google no longer publishes a universal table.
3. **Going with:** free tier during local development; **paid before the first real user uploads a real resume** — a launch-day line, not a scale threshold. ~$10–30/month.
4. **Could change if:** you keep the free tier *and* disclose training in the privacy policy — legitimate, but the PRD's privacy claim must then be rewritten. **The tension is recorded, not resolved.**

`S-22`, `S-23` · Approved with caveat

---

### L067 — Local-first development

1. **Initially stated:** Railway Hobby from the outset (L019).
2. **What changed:** infrastructure access became uncertain. Separately, **I was wrong that payments require deployment** — Stripe's CLI forwards webhooks to `localhost`, and a tunnel does the same for Razorpay. Local development is fully viable.
3. **Going with:** build locally in Docker — Postgres, Next.js, Mailpit. Deploy when infrastructure is available. **No code rewrite at deploy** — the Dockerfile (L043) guarantees an identical image, and `pg_dump` moves the data (L025).
4. **Could change if:** nothing blocks it. Deployment is a config change, by design.

`2026-08-25` · Approved · **Corrects my earlier overstatement**

---

### L068 / L069 / L070 — SSO

1. **Initially stated:** SSO was **rejected** for MVP — I'd advised it added OAuth complexity for little value.
2. **What changed:** you asked for Google + LinkedIn on both signup and login. Also: **LinkedIn requires a verified company Page to create the app at all** — so it can't be deferred to staging as assumed; it blocks local testing too. Google permits `localhost` redirect URIs freely.
3. **Going with:** Google in MVP. LinkedIn once the Page exists (L074). **Linking rule:** auto-link when the provider asserts a verified email; if the existing account is *unverified*, link but invalidate its password and force a reset — this closes an account-takeover hole. SSO-only users can set a password and hold both methods.
4. **Could change if:** LinkedIn's Page requirement proves burdensome → ship Google only. Google alone covers most signups.

**Schema impact:** `users.password_hash` becomes nullable · new `oauth_accounts` table (`user_id`, `provider`, `provider_user_id`, `UNIQUE(provider, provider_user_id)`) · a user with neither password nor linked OAuth account must be impossible.

`2026-08-25` · Approved · **Reverses my earlier recommendation**

---

### L071 — Verification: OTP over magic link

1. **Initially stated:** *"verification link working principle is different compared to otp. so you can think and suggest me."*
2. **What changed:** magic links have an underrated failure mode — email security scanners pre-fetch links and consume single-use tokens before the user clicks. They also break across devices. OTP works identically on web and the planned mobile client (L020) with no deep-link handling.
3. **Going with:** 6-digit numeric OTP · `crypto.randomInt` (**never `Math.random`**) · stored hashed · 10-minute expiry · max 5 attempts then invalidate · max 3 resends/hour · single use. **Distinguish "expired — resend" from "incorrect — N attempts left."** Applies to both password and SSO signups.
4. **Could change if:** OTP entry friction hurts conversion → offer both, link plus code, in the same email.

**Schema impact:** `verification_tokens` gains an `attempts` counter · new `email_log` table (recipient, purpose, `sent_at`, provider message ID, `failed_at`) — gives send tracking *and* doubles as the Brevo quota counter for L036.

`2026-08-25` · Approved

---

### L072 / L073 — Local development environment

1. **Initially stated:** my `.env.example` proposed `EMAIL_TRANSPORT=console`.
2. **What changed:** you pointed out local SMTP servers exist and the send logic shouldn't be skipped. Correct — console logging bypasses the code path you most need to test.
3. **Going with:** **Mailpit** in Docker — real SMTP on `:1025`, web UI on `:8025`. Code sends normally; only the transport env var changes at deploy. **Payments:** Stripe test mode + Stripe CLI webhook forwarding; Razorpay test mode + tunnel. Dummy transactions end to end; real keys swapped at deploy.
4. **Could change if:** nothing. This is standard practice.

`2026-08-25` · Approved

---

## Update protocol

- **Part 1** is the scan layer — one line per decision, always current.
- **Part 2** carries history only where a decision moved. Settled-first-time items stay in Part 1.
- Nothing enters as `Approved` without your explicit word. Inferred items are marked pending.
- Superseded entries are marked, never deleted.
- Session logs freeze on write — verbatim quotes stay exact rather than decaying.

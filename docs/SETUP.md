# SETUP.md — Trackr

Ordered checklist to get from nothing to "first task ready". **Do these in order.**

Nothing here needs wireframes. Nothing here needs Railway.

---

# PHASE 0 — Repository

Do this yourself. It's deterministic work — no AI needed (§35 Level 0).

- [ ] **Create a private GitHub repository** — `trackr`
- [ ] Clone locally
- [ ] `CLAUDE.md` at the **repo root** (not in `docs/`) — this is where Claude Code looks
- [ ] `docs/` — everything else: `DECISIONS.md`, `TASKS.md`, `ISSUES.md`, `SECURITY.md`, `DATABASE.md`, `DATABASE-SECURITY.md`, `BACKEND.md`, `FRONTEND.md`, `PLATFORM.md`, `TESTING.md`, `GIT.md`, `CODECONDUCT.md`, `TASK-REFERENCE.md`, `REPORTS.md`, `FEATURE-A-SPEC.md`, `README-DOCS.md`
- [ ] `docs/sessions/` — the two frozen session logs
- [ ] `docs/archive/` — the four superseded documents
- [ ] `.github/ISSUE_TEMPLATE/task.md`
- [ ] **`.gitignore` before the first commit:**
  ```
  node_modules/
  .next/
  .env
  .env.local
  *.log
  *.pem
  *.key
  /dumps
  ```
- [ ] Commit and push
- [ ] **Branch protection on `main`** — require a PR, no direct pushes, no force-push

> ⚠️ `.gitignore` goes in *before* the first commit. A secret committed once lives in history forever — the fix is rotating the credential, not rewriting history.

---

# PHASE 1 — Local environment

## 1.1 Prerequisites

- [ ] **Node 24 LTS** — `node -v` should print v24.x. Node 20 reached EOL in April 2026
- [ ] **Docker Desktop** running
- [ ] **Claude Code** installed

## 1.2 Postgres version — resolved from documentation

Railway's Postgres plugin lets you pick the version at provisioning time; **the
default is 16** (14, 15 and 17 also available).

- [ ] Pin **PostgreSQL 16** in `docker-compose.yml`
- [ ] At provisioning time, accept Railway's default — do not change it

**Why match the default rather than pick the newest:** 16 is what you get by
clicking through provisioning. Choosing 17 means remembering to select it under
deploy-day pressure. Your workload uses ~0.05% of a small instance (L033), so
17's improvements are irrelevant here. One fewer thing to get wrong. (L088)

## 1.3 Docker services

- [ ] `docker-compose.yml` at repo root — Postgres, Mailpit, and a profile-gated `app`
- [ ] **`.dockerignore` at repo root** — without it, `COPY . .` bakes `.env` and
      `.git` into an image layer, recoverable via `docker history`
- [ ] `docker compose up -d` — starts **Postgres + Mailpit only**
- [ ] Confirm Postgres: `docker compose exec postgres psql -U trackr -d trackr_dev -c 'SELECT version();'` → expect 16
- [ ] Confirm Mailpit: open `http://localhost:8025`

**Two modes, and you'll use both:**

| Command | Runs | When |
|---|---|---|
| `docker compose up -d` | Postgres + Mailpit; app on host via `npm run dev` | Daily — fast hot reload |
| `docker compose --profile full up --build` | + app in its production container | Before deploying |

The second mode catches what `npm run dev` hides: the strict production CSP,
missing env vars, and a misconfigured standalone build.

⚠️ **Inside the Docker network, `localhost` means the container itself.** The
`app` service reaches Postgres at `postgres:5432` and Mailpit at `mailpit:1025`,
not `localhost`. Already set in the compose file — but it's the first thing that
confuses people running the app in a container.

## 1.4 Next.js scaffold

**Run this yourself, not through Claude Code.** Scaffolding is deterministic and generates hundreds of files — an AI-generated scaffold is a large diff you can't meaningfully review, and you'd be paying tokens for `create-next-app`.

```bash
npx create-next-app@latest . --typescript --tailwind --eslint --app --src-dir=false --import-alias "@/*"
```

- [ ] Verify `npm run dev` serves `localhost:3000`
- [ ] Set `output: 'standalone'` in `next.config.js` — **the Dockerfile's third stage needs it**
- [ ] Commit the scaffold on its own, before any task branch

## 1.5 Environment file

- [ ] `.env.example` committed
- [ ] `.env` created locally, **not committed**
- [ ] `SESSION_SECRET` — `openssl rand -base64 32`
- [ ] `DATABASE_URL` pointing at the Docker Postgres
- [ ] `EMAIL_TRANSPORT=mailpit`

## 1.6 Dockerfile

- [ ] Dockerfile at repo root (L043)
- [ ] `docker build .` succeeds

**Do this now, not at deploy.** A Dockerfile written months later against an evolved app is a debugging session. Written now against a hello-world, it's ten minutes — and it's what makes L025 portability real rather than theoretical.

---

# PHASE 2 — External accounts

Only two are needed to start:

- [ ] **Google Cloud Console** — OAuth 2.0 client, `openid profile email` scopes
  - Redirect URI: `http://localhost:3000/api/oauth/google/callback`
  - Free. `localhost` is explicitly permitted for development.
- [ ] **Google AI Studio** — Gemini API key (free tier for local dev — L059)
  - **While you're there: read your actual quota. That closes L066.**

**Not needed yet:** Brevo (Mailpit covers local), Cloudflare R2 (no paid users), Stripe/Razorpay (F6), LinkedIn (L074 — needs a company Page you don't have).

---

# PHASE 3 — First tasks

Now use Claude Code. Order matters:

| Order | Task | Why first |
|---|---|---|
| 1 | **T1.1** Migration tooling | Everything depends on it. Small, self-contained. Proves the Docker + Postgres loop end to end. |
| 2 | **T1.2** `users` table | First real schema. Exercises the issue → branch → PR → merge cycle on something low-risk. |
| 3 | **T2.1** Argon2id module | Pure logic, fully unit-testable, no DB. Good second checkpoint. |

**For each:** draft the issue → **you approve** → branch → implement → PR → **you review** → merge → tick `TASKS.md`.

Run the first three deliberately. The loop matters more than the code at this stage — you're testing whether the control system works before anything important depends on it.

---

# PHASE 4 — Before touching the high-risk three

`TASKS.md` flags **T2.3** (session middleware), **T4.3** (account linking), **T5.1** (AI provider interface) as load-bearing. Four later features inherit whatever you build there.

Before starting any of them:
- [ ] Re-read `SECURITY.md` §2 for that task's specific gaps
- [ ] Confirm the required security tests exist in the issue's acceptance criteria
- [ ] Review the PR twice — once for correctness, once against `SECURITY.md` alone

---

# WHAT YOU CANNOT DO YET

| Blocked | On |
|---|---|
| All 7 frontend tasks (P8) | Wireframes |
| LinkedIn SSO (T4.4) | Company Page — L074 |
| Deployment | Railway/host access |
| Email deliverability testing | A real domain |
| Payments (F6) | Not designed yet |

**None of these block the 31 backend tasks.** That's weeks of work available right now.

---

# OPEN ITEMS TO RESOLVE ALONG THE WAY

| ID | Question | Needed by |
|---|---|---|
| L066 | Real Gemini quota — check AI Studio in Phase 2 | T5.2 |
| L029 | Confirm Brevo | T3.5 (verification emails) |
| — | Does `contact_email` need its own verification before F4 uses it as Reply-To? **My view: yes** | F4 |
| — | Session absolute expiry vs sliding renewal | T2.2 |
| ~~—~~ | ~~Verify local Postgres version~~ — **resolved: both 16 (L088)** | ✅ closed |

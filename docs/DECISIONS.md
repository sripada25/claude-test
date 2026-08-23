# Trackr — Decision Ledger

**Current state only.** Full verbatim exchanges live in `./sessions/`.
Regenerated each session — always download the newest version.

**Repo layout:**
```
docs/
  DECISIONS.md                    ← this file (rewritten each session)
  sessions/
    2026-08-23-stack.md           ← frozen, never rewritten
    2026-08-24-feature-a.md       ← frozen, never rewritten
```

Click any `S-xx` to open the exact exchange that produced the decision.

---

## Approved — Feature A (User Accounts) · 2026-08-24

| ID | Decision | Why | Source |
|----|----------|-----|--------|
| L039 | Auth self-built (Argon2id + httpOnly session cookies + server-side `sessions` table) | Consistent with L025. **Railway provides no session strategy** — it's infrastructure only. Sessions live in your Postgres + your code, so moving platforms requires **zero rework**; the session table travels in the `pg_dump`. | [S-17](./sessions/2026-08-24-feature-a.md#L32) |
| L040 | Email verification required — **before first AI generation**, not before signup | Doesn't kill activation, but gates the point where cost and abuse actually live (free generations, 12-day trial) | [S-16](./sessions/2026-08-24-feature-a.md#L14) |
| L041 | Capture user timezone at signup from browser | Without it every 7-day reminder fires at the wrong local hour for the primary market. Backfill is impossible to do accurately later. | [S-16](./sessions/2026-08-24-feature-a.md#L14) |
| L044 | A1 — httpOnly cookie + server-side session table, not JWT | Revocable. Logout must actually invalidate server-side. | [S-17](./sessions/2026-08-24-feature-a.md#L32) |
| L045 | A2 — skills as free-text tags, `text[]`, lowercase-normalized | PRD (p.11, p.13) names `skills` but never specifies storage — `[ASSUMPTION]`. In MVP skills only feed the Gemini prompt, which needs no canonical forms. Controlled vocabulary only pays off for job *matching*, explicitly rejected from MVP (PRD p.14). | [S-18](./sessions/2026-08-24-feature-a.md#L47) |
| L046 | A3 — `experience_level` as enum: Junior / Mid / Senior / Lead | Feeds prompt construction; free text produces inconsistent generation | [S-16](./sessions/2026-08-24-feature-a.md#L14) |
| L047 | **A4 — profile is mandatory before app access.** Flow: signup → profile (manual **or** resume upload) → profile complete → app access | Your call. Removes the "gate generation on completeness" complexity entirely — simpler than the original proposal. Trade-off: added signup friction, heavily mitigated by resume upload. | [S-19](./sessions/2026-08-24-feature-a.md#L57) |
| L048 | A4 — resume auto-fill uses **hybrid pipeline**: `pdf-parse` (deterministic, free) → Gemini Flash for structuring → pre-filled form → **mandatory user review** → save | Script-only parsing gets ~40–60% accuracy across two-column layouts, tables, varied headers. **Cost fear was inverted:** parsing is ~1 call per user *ever* (~1,000 total at 1,000 users) vs generation at ~5,000/month. Parsing is a rounding error. | [S-19](./sessions/2026-08-24-feature-a.md#L57) |
| L049 | A4 — parse output is **never saved blind**; user review step is mandatory | The review pass, not the mandatoriness, is what actually guarantees no garbage | [S-19](./sessions/2026-08-24-feature-a.md#L57) |
| L050 | **A5 — two separate email fields:** `users.email` (login identity, re-verification on change) and `profiles.contact_email` (appears on documents, used as Reply-To for recruiters) | Your catch. Registered email ≠ resume email. Most tools conflate these and it bites them later. Directly affects L038. | [S-20](./sessions/2026-08-24-feature-a.md#L73) |
| L051 | A5 — email is changeable, with re-verification | Basic expected feature | [S-20](./sessions/2026-08-24-feature-a.md#L73) |
| L052 | A6 — password policy: min 12 chars, no complexity rules, no breach-check in MVP | Length beats symbol-soup | [S-16](./sessions/2026-08-24-feature-a.md#L14) |
| L053 | L013 — **PRD Phase 0 does not gate the build.** Run WhatsApp validation in parallel with F1/F2. | F1 (accounts) and F2 (tracker) are required in **every** scenario, including a pivot away from call notes. Only F5 (post-call log) is genuinely contingent on the research. | [S-16](./sessions/2026-08-24-feature-a.md#L14) |

## Approved — Stack

| ID | Decision | Why | Source |
|----|----------|-----|--------|
| L017 | Modular monolith, single deployable | Rewrites are caused by tangled logic and missing API boundaries, not by monoliths | [S-04](./sessions/2026-08-23-stack.md#s-04--architecture--l017) |
| L018 | All logic behind JSON APIs; web + mobile are peer clients | The single thing that makes the future mobile app cheap instead of a rewrite | [S-05](./sessions/2026-08-23-stack.md#s-05--api-boundary--l018) |
| L019 | Railway Hobby hosting | ~$6–12/mo realistic. **Hobby is a minimum spend, not a cap** — usage bills on top | [S-06](./sessions/2026-08-23-stack.md#s-06--hosting--l019) |
| L020 | React + TypeScript + Tailwind, no component library; web first | Small bundle, no library lock-in | [S-07](./sessions/2026-08-23-stack.md#s-07--frontend--platform-order--l020) |
| L021 | Next.js on Railway | Auto-detected and built on push. Nothing to install on Railway — push a repo with `package.json` | [S-08](./sessions/2026-08-23-stack.md#s-08--nextjs-on-railway--l021) |
| L021a | **Correction (2026-08-23):** builder is **Railpack**, not Nixpacks | Railpack replaced Nixpacks on 2026-03-04; Nixpacks is in maintenance mode. Deployment answer unchanged — only the builder's name and internals differ. | [S-15](./sessions/2026-08-23-stack.md#s-15--builder-correction-railpack--l021a-l043) |
| L022 | Railway managed Postgres | Standard PostgreSQL, not a fork → `pg_dump` works → satisfies L025 | [S-09](./sessions/2026-08-23-stack.md#s-09--database-supabase-portability-backups--l022-l023-l024-l025-l026) |
| L023 | Supabase **not** used | Its `auth` schema is the one thing that can't cleanly `pg_dump` — contradicts L025 | [S-09](./sessions/2026-08-23-stack.md#s-09--database-supabase-portability-backups--l022-l023-l024-l025-l026) |
| L025 | Free, complete DB portability is a **standing requirement** | No vendor-specific persistence anywhere in the system | [S-09](./sessions/2026-08-23-stack.md#s-09--database-supabase-portability-backups--l022-l023-l024-l025-l026) |
| L026 | Backups: nightly `pg_dump` → R2, Phase 1 | Deferred, not skipped. ~20 lines, costs nothing, provider-independent artifact | [S-09](./sessions/2026-08-23-stack.md#s-09--database-supabase-portability-backups--l022-l023-l024-l025-l026) |
| L027 | Document storage: Cloudflare R2 | Free 10 GB, zero egress fees | [S-10](./sessions/2026-08-23-stack.md#s-10--document-storage--l027) |
| L030 | **Excluded:** Kubernetes, Redis, microservices, managed DB, multi-service deploys | K8s floor is $60–100/mo before a single user, and solves a problem you don't have | [S-13](./sessions/2026-08-23-stack.md#s-13--kubernetes-and-infrastructure-exclusions--l030) |

## Approved — Workflow

| ID | Decision | Why | Source |
|----|----------|-----|--------|
| L015 | Allow-list scoping + version-pinned approval | Deny-lists implicitly permit everything unlisted. Approval binds to a git SHA, so it can't drift or be faked by typing "Approved" | 2026-08-22 |
| L016 | Ledger updated only on explicit approval, never silently | A drifting ledger is worse than none — it produces false confidence | 2026-08-22 |

## Awaiting your confirmation

| ID | Proposed | Why it matters | Source |
|----|----------|----------------|--------|
| L028 | Hybrid storage: text canonical in Postgres, PDF client-rendered, R2 only on explicit save | Text is **43× smaller** than PDF. All-PDF = ~54 GB/yr at 1,000 users | [S-11](./sessions/2026-08-23-stack.md#s-11--sizing-math--l028-l031l037) |
| L029 | Email provider: Brevo | Railway has **no** email service. Brevo 300/day (~300 users) vs Resend 100/day (~100 users) | [S-12](./sessions/2026-08-23-stack.md#s-12--email-provider--l029) |
| L043 | **Add a Dockerfile instead of relying on Railpack** | ⚠️ **Conflicts with L025.** Railpack is Railway-exclusive — those builds don't move to another platform. Same lock-in category that got Supabase rejected (L023), just at the build layer. A Dockerfile is auto-detected and takes priority over Railpack, costs one file, and makes the build portable to Hetzner/DO/anywhere. | [S-15](./sessions/2026-08-23-stack.md#s-15--builder-correction-railpack--l021a-l043) |

## Sizing — canonical, do not re-derive

| ID | Conclusion | Source |
|----|-----------|--------|
| L031 | ~200 KB DB growth per user per month | [S-11](./sessions/2026-08-23-stack.md#s-11--sizing-math--l028-l031l037) |
| L032 | 1,000 users / 12 months → ~3.4 GB Postgres incl. indexes | [S-11](./sessions/2026-08-23-stack.md#s-11--sizing-math--l028-l031l037) |
| L033 | 1,000 users → ~2.5 writes/min, ~9 reads/min — **~0.05% of a small Postgres instance** | [S-11](./sessions/2026-08-23-stack.md#s-11--sizing-math--l028-l031l037) |
| L034 | **Compute is not the constraint — Gemini Flash's 15 req/min burst is.** Job queue with backoff required, Phase 2 | [S-11](./sessions/2026-08-23-stack.md#s-11--sizing-math--l028-l031l037) |
| L035 | Email ~30/user/month → Brevo free tier ≈ 300 users | [S-12](./sessions/2026-08-23-stack.md#s-12--email-provider--l029) |
| L036 | Own send-queue required — reminders cluster, Brevo doesn't auto-queue past 300/day | [S-12](./sessions/2026-08-23-stack.md#s-12--email-provider--l029) |
| L037 | Resume PDF assumed 150 KB (your range: 100–200 KB) | [S-11](./sessions/2026-08-23-stack.md#s-11--sizing-math--l028-l031l037) |

## 🔴 Blocking

| ID | Question | Blocks | Source |
|----|----------|--------|--------|
| L038 | **Follow-up email delivery mechanism.** You said sending is needed. Three options: **(A)** draft + copy — ~0 cost, no risk · **(B)** send via Brevo with `Reply-To:` = user's `contact_email` — ~1 week, no OAuth, no Google review, but deliverability risk from many users on one sending domain · **(C)** Gmail OAuth send-as-user — 3–4 weeks + Google restricted-scope security review, which can be rejected. **Recommend B.** | F4 | [S-21](./sessions/2026-08-24-feature-a.md#L88) |
| L054 | **Free vs Pro split for follow-up.** Recommend: **drafting free, sending Pro.** Sending costs real money (Brevo volume) and is the higher-value action — cost aligns with revenue, natural upgrade lever. | F4, F6 | [S-21](./sessions/2026-08-24-feature-a.md#L88) |
| L055 | Does generating a follow-up draft count against the **5/month free generation quota**, or is it a separate allowance? It's a Gemini call either way. | F3, F4 | [S-21](./sessions/2026-08-24-feature-a.md#L88) |
| L043 | Add a Dockerfile instead of relying on Railpack (see *Awaiting confirmation*) | Deploy | [S-15](./sessions/2026-08-23-stack.md#s-15--builder-correction-railpack--l021a-l043) |

## Superseded

| ID | Was | Superseded by |
|----|-----|---------------|
| L002 | Android MVP first, iOS later | L020 — web first |
| L012 | React Native + Expo | L020 — React web; RN deferred to mobile phase |
| L007 | "Gemini free tier sufficient" (daily 1,500 limit) | L034 — the 15/min burst is the real constraint |

## Settled from PRD — not to be revisited

`L001` $9.99 US pricing · `L003` no job-search engine in MVP · `L004` no ATS scoring · `L005` no local Qwen 3 · `L006` no iOS call recording in MVP

---

## Update protocol

- **This file** is rewritten each session. Download the newest.
- **Session logs** are frozen on write and never touched again — so verbatim quotes stay accurate rather than decaying into paraphrase over a long conversation.
- Nothing is logged as `Approved` without your explicit word. Inferred items sit in *Awaiting confirmation* until you say so.
- Superseded entries are marked, never deleted.
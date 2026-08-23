# Trackr — Decision Ledger

**Current state only.** Full verbatim exchanges live in `./sessions/`.
Regenerated each session — always download the newest version.

**Repo layout:**
```
docs/
  DECISIONS.md                    ← this file (rewritten each session)
  sessions/
    2026-08-23-stack.md           ← frozen, never rewritten
```

Click any `S-xx` (Ctrl+click in the editor) to jump to that exchange.
Cursor’s editor ignores Markdown heading slugs (`#s-04-…`); these links use `#L` line numbers instead.

---

## Approved — Stack

| ID | Decision | Why | Source |
|----|----------|-----|--------|
| L017 | Modular monolith, single deployable | Rewrites are caused by tangled logic and missing API boundaries, not by monoliths | [S-04](./sessions/2026-08-23-stack.md#L13) |
| L018 | All logic behind JSON APIs; web + mobile are peer clients | The single thing that makes the future mobile app cheap instead of a rewrite | [S-05](./sessions/2026-08-23-stack.md#L36) |
| L019 | Railway Hobby hosting | ~$6–12/mo realistic. **Hobby is a minimum spend, not a cap** — usage bills on top | [S-06](./sessions/2026-08-23-stack.md#L50) |
| L020 | React + TypeScript + Tailwind, no component library; web first | Small bundle, no library lock-in | [S-07](./sessions/2026-08-23-stack.md#L73) |
| L021 | Next.js on Railway | Nixpacks auto-detects it. Nothing to install on Railway — push a repo with `package.json` | [S-08](./sessions/2026-08-23-stack.md#L87) |
| L022 | Railway managed Postgres | Standard PostgreSQL, not a fork → `pg_dump` works → satisfies L025 | [S-09](./sessions/2026-08-23-stack.md#L100) |
| L023 | Supabase **not** used | Its `auth` schema is the one thing that can't cleanly `pg_dump` — contradicts L025 | [S-09](./sessions/2026-08-23-stack.md#L100) |
| L025 | Free, complete DB portability is a **standing requirement** | No vendor-specific persistence anywhere in the system | [S-09](./sessions/2026-08-23-stack.md#L100) |
| L026 | Backups: nightly `pg_dump` → R2, Phase 1 | Deferred, not skipped. ~20 lines, costs nothing, provider-independent artifact | [S-09](./sessions/2026-08-23-stack.md#L100) |
| L027 | Document storage: Cloudflare R2 | Free 10 GB, zero egress fees | [S-10](./sessions/2026-08-23-stack.md#L118) |
| L030 | **Excluded:** Kubernetes, Redis, microservices, managed DB, multi-service deploys | K8s floor is $60–100/mo before a single user, and solves a problem you don't have | [S-13](./sessions/2026-08-23-stack.md#L185) |

## Approved — Workflow

| ID | Decision | Why | Source |
|----|----------|-----|--------|
| L015 | Allow-list scoping + version-pinned approval | Deny-lists implicitly permit everything unlisted. Approval binds to a git SHA, so it can't drift or be faked by typing "Approved" | 2026-08-22 |
| L016 | Ledger updated only on explicit approval, never silently | A drifting ledger is worse than none — it produces false confidence | 2026-08-22 |

## Awaiting your confirmation

| ID | Proposed | Why it matters | Source |
|----|----------|----------------|--------|
| L024 | Auth self-built (Argon2id + httpOnly sessions) | **Inferred from L023, not stated by you.** ~2 weeks, highest-security surface in the project | [S-09](./sessions/2026-08-23-stack.md#L100) |
| L028 | Hybrid storage: text canonical in Postgres, PDF client-rendered, R2 only on explicit save | Text is **43× smaller** than PDF. All-PDF = ~54 GB/yr at 1,000 users | [S-11](./sessions/2026-08-23-stack.md#L130) |
| L029 | Email provider: Brevo | Railway has **no** email service. Brevo 300/day (~300 users) vs Resend 100/day (~100 users) | [S-12](./sessions/2026-08-23-stack.md#L164) |

## Sizing — canonical, do not re-derive

| ID | Conclusion | Source |
|----|-----------|--------|
| L031 | ~200 KB DB growth per user per month | [S-11](./sessions/2026-08-23-stack.md#L130) |
| L032 | 1,000 users / 12 months → ~3.4 GB Postgres incl. indexes | [S-11](./sessions/2026-08-23-stack.md#L130) |
| L033 | 1,000 users → ~2.5 writes/min, ~9 reads/min — **~0.05% of a small Postgres instance** | [S-11](./sessions/2026-08-23-stack.md#L130) |
| L034 | **Compute is not the constraint — Gemini Flash's 15 req/min burst is.** Job queue with backoff required, Phase 2 | [S-11](./sessions/2026-08-23-stack.md#L130) |
| L035 | Email ~30/user/month → Brevo free tier ≈ 300 users | [S-12](./sessions/2026-08-23-stack.md#L164) |
| L036 | Own send-queue required — reminders cluster, Brevo doesn't auto-queue past 300/day | [S-12](./sessions/2026-08-23-stack.md#L164) |
| L037 | Resume PDF assumed 150 KB (your range: 100–200 KB) | [S-11](./sessions/2026-08-23-stack.md#L130) |

## 🔴 Blocking

| ID | Question | Blocks | Source |
|----|----------|--------|--------|
| L038 | **Send follow-up emails to recruiters on the user's behalf, or draft-and-copy?** Send-on-behalf needs Gmail OAuth + Google security review (~3–4 weeks). Changes F4 task count ~5× | F4 | [S-14](./sessions/2026-08-23-stack.md#L210) |
| L039 | Confirm L024 — self-built auth? | F1 | — |
| L040 | Email verification required before app use? | F1 | — |
| L041 | Capture user timezone at signup? Without it every 7-day reminder fires at the wrong local time | F1, F4 | — |
| L042 | A1–A6: session strategy, skills vocabulary, experience enum, profile mandatory?, email changeable, password policy | F1 | — |
| L013 | Does PRD Phase 0 validation gate Phase 1 build? | Sequencing | — |

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

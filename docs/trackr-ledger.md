# Trackr — Project Ledger

Single source of truth for decisions, assumptions, and task status.
Every entry has a date, a type, and a status. Nothing is edited in place —
superseded entries are marked SUPERSEDED, not deleted, so history stays intact.

Entry types: DECISION · ASSUMPTION · OPEN-QUESTION · TASK · RETRACTED

---

## 2026-08-13 — Baseline (from PRD v0.1)

| ID | Type | Entry | Status |
|----|------|-------|--------|
| L001 | DECISION | US pricing set at $9.99/mo, not $4.99 (signals quality) | Confirmed in PRD |
| L002 | DECISION | MVP scope = Android only, iOS via Call Notes bridge later | Confirmed in PRD |
| L003 | RETRACTED | Job search/matching engine as MVP — scope creep | Closed |
| L004 | RETRACTED | ATS scoring as a feature — noise without action | Closed |
| L005 | RETRACTED | Local Qwen 3 for AI generation — no distribution trust | Closed |
| L006 | RETRACTED | iOS call recording in MVP — Apple API blocked since iOS 14 | Closed |
| L007 | ASSUMPTION | Gemini Flash free tier (1500 req/day) sufficient for MVP volume | Untested |
| L008 | ASSUMPTION | Adzuna job data adequate for Indian/remote markets | Untested |
| L009 | ASSUMPTION | Indian users will pay ₹349/mo — price sensitivity unvalidated | Untested |
| L010 | ASSUMPTION | US users will pay $9.99/mo — conversion unvalidated | Untested |
| L011 | ASSUMPTION | 5 free generations/month is the right free-tier limit | Untested |
| L012 | ASSUMPTION | React Native + Expo performs acceptably on mid-range Android | Untested |

## 2026-08-22 — Open decisions surfaced during planning-workflow design

| ID | Type | Entry | Status |
|----|------|-------|--------|
| L013 | OPEN-QUESTION | Does Phase 0 (WhatsApp pain-point validation) gate the start of Phase 1 build? | **Awaiting your call** |
| L014 | OPEN-QUESTION | Build order: Android call recording vs iOS Call Notes bridge — which first? | **Awaiting your call** |
| L015 | DECISION | Adopted allow-list scoping + version-pinned approval for AI-assisted dev workflow | Approved (this session) |
| L016 | DECISION | Ledger maintained as this file; updated only on explicit "approved" from you | Approved (this session) |

## 2026-08-23 — Stack decisions (approved by you this session)

| ID | Type | Entry | Status |
|----|------|-------|--------|
| L017 | DECISION | Architecture: modular monolith, single deployable | **Approved** |
| L018 | DECISION | API boundary: all logic behind JSON endpoints; web + future mobile are both clients | **Approved** |
| L019 | DECISION | Hosting: Railway Hobby plan | **Approved** |
| L020 | DECISION | Frontend: React + TypeScript + TailwindCSS, no 3rd-party component library | **Approved** |
| L021 | DECISION | Database: Railway managed Postgres (standard PG — `pg_dump` portability preserved) | **Approved** |
| L022 | DECISION | Document storage: Cloudflare R2 (Option B) | **Approved** |
| L023 | DECISION | Supabase NOT used — its `auth` schema undermines the stated lift-and-shift priority (L025) | **Approved** (supersedes PRD assumption) |
| L024 | DECISION | Auth: self-built on Postgres (Argon2id + httpOnly session cookies) | Implied by L023 — **confirm** |
| L025 | DECISION | Free, complete DB portability is a standing requirement; no vendor-specific persistence | **Approved** |
| L026 | DECISION | Backups: nightly `pg_dump` → R2, provider-independent. Deferred to Phase 1, not skipped. | **Approved** |
| L027 | DECISION | Storage pattern: generated text canonical in Postgres; PDF rendered client-side; R2 only on explicit user save | Recommended — **awaiting confirm** |
| L028 | DECISION | Email provider: Brevo (300/day free) over Resend (100/day) | Recommended — **awaiting confirm** |
| L029 | DECISION | Kubernetes, Redis, microservices, managed DB, multi-service deploys — all excluded from MVP | **Approved** |

## 2026-08-23 — Sizing conclusions (canonical, do not re-derive)

| ID | Type | Entry | Status |
|----|------|-------|--------|
| L030 | ASSUMPTION | ~200 KB DB growth per user per month (30 applications, JD ~4 KB, doc text ~3.5 KB) | Modelled, unvalidated |
| L031 | ASSUMPTION | At 1,000 users / 12 months: ~3.4 GB Postgres incl. indexes | Modelled |
| L032 | ASSUMPTION | At 1,000 users: ~2.5 writes/min, ~9 reads/min average — ~0.05% of a small Postgres instance | Modelled |
| L033 | DECISION | **Compute is not the constraint. Gemini Flash's 15 req/minute burst limit is.** Requires a job queue with backoff in Phase 2. | **Confirmed by analysis** |
| L034 | ASSUMPTION | Email volume ~30/user/month → Brevo free tier supports ~300 users | Modelled |
| L035 | ASSUMPTION | Reminder emails cluster in morning batches; Brevo does not auto-queue past 300/day → own send queue required | Design requirement |

## Still open — blocking

| ID | Type | Entry | Status |
|----|------|-------|--------|
| L036 | OPEN-QUESTION | **Q2:** Does the app send follow-up emails *to recruiters on the user's behalf* (needs Gmail OAuth, ~3–4 weeks + Google security review), or only draft text for the user to copy/send? | **Blocking F4** |
| L037 | OPEN-QUESTION | Q3: Is email verification required before app use? | Blocking F1 |
| L038 | OPEN-QUESTION | Q8: User timezone captured at signup? (7-day reminders fire wrong otherwise) | Blocking F1 + F4 |
| L039 | OPEN-QUESTION | A1–A6: session strategy, skills vocabulary, experience enum, profile mandatory?, email change, password policy | Blocking F1 |
| L013 | OPEN-QUESTION | Does Phase 0 validation gate Phase 1 build? | Still open |
| L014 | OPEN-QUESTION | Android call recording vs iOS Call Notes — build order | Still open (post-MVP) |

---

## How this updates

- I append new rows when you say **"approved"**, **"log this,"** or similar — never silently.
- Each update is shown to you as a diff-style summary in chat before/as it's written, so drift is visible immediately.
- Superseded entries get a new row with `Status: SUPERSEDED — see L0xx`, old row stays as-is.
- This file lives in your project; re-upload/reference it each session so I read current state rather than reconstructing from memory.

---

> **⚠️ HISTORICAL — restored 2026-08-25.** This was the first ledger version. Its
> numbering diverges from the current `DECISIONS.md` (this file's L029 is "no
> Kubernetes"; the current file's L029 is "Brevo"). Kept for history. **Use
> `DECISIONS.md` as the live ledger.**

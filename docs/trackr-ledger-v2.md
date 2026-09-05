# Trackr — Project Ledger v2

Single source of truth for decisions, assumptions, and task status.
Every entry carries **your answer**, **why it was decided**, and a **source link** to your verbatim words in the appendix.

Entry types: DECISION · ASSUMPTION · OPEN-QUESTION · TASK · RETRACTED
Click any `S-xx` to jump to the exact text you wrote.

---

## 2026-08-13 — Baseline (from PRD v0.1)

| ID | Type | Entry | Your input | Why | Source | Status |
|----|------|-------|-----------|-----|--------|--------|
| L001 | DECISION | US pricing $9.99/mo, not $4.99 | From PRD | $4.99 signals low quality; US users equate price with value | PRD p.4 | Confirmed |
| L002 | DECISION | Android MVP first, iOS later | Superseded — see L038 | — | PRD p.1 | **SUPERSEDED** |
| L003 | RETRACTED | Job search/matching engine as MVP | From PRD | Scope creep; delays the actual differentiator | PRD p.4 | Closed |
| L004 | RETRACTED | ATS scoring | From PRD | Scoring without action is noise | PRD p.4 | Closed |
| L005 | RETRACTED | Local Qwen 3 for AI generation | From PRD | Desktop-only distribution, no install trust | PRD p.4 | Closed |
| L006 | RETRACTED | iOS call recording in MVP | From PRD | Apple blocked the APIs in iOS 14 | PRD p.4 | Closed |
| L007 | ASSUMPTION | Gemini Flash free tier sufficient | From PRD | — | PRD p.3 | **Revised — see L033** |
| L008 | ASSUMPTION | Adzuna adequate for India/remote | From PRD | — | PRD p.3 | Untested (v2 feature) |
| L009 | ASSUMPTION | Indian users pay ₹349/mo | From PRD | — | PRD p.4 | Untested |
| L010 | ASSUMPTION | US users pay $9.99/mo | From PRD | — | PRD p.4 | Untested |
| L011 | ASSUMPTION | 5 free generations/month is right | From PRD | — | PRD p.4 | Untested |
| L012 | ASSUMPTION | React Native + Expo performs on mid-range Android | Superseded | Web-first now; RN deferred to mobile phase | PRD p.4 | **SUPERSEDED by L020** |

---

## 2026-08-22 — Workflow decisions

| ID | Type | Entry | Your input | Why | Source | Status |
|----|------|-------|-----------|-----|--------|--------|
| L013 | OPEN-QUESTION | Does Phase 0 validation gate Phase 1 build? | Not yet answered | PRD makes Phase 0 a gate, but you may want to build in parallel | [S-01](#s-01) | **Open** |
| L014 | OPEN-QUESTION | Android recording vs iOS Call Notes — build order | Not yet answered | Post-MVP; not urgent | PRD p.20 | Open |
| L015 | DECISION | Allow-list scoping + version-pinned approval for AI-assisted dev | You asked me to revise your 50-section instruction doc and apply all fixes | **Allow-list:** deny-lists implicitly permit everything unlisted, so scope is defined as what MAY be touched. **Version-pinning:** an approved prompt lives at a git commit SHA; the issue references the SHA rather than embedding a copy, so it can't drift or be faked by typing "Approved". | [S-02](#s-02) | **Approved** |
| L016 | DECISION | Ledger updated only on your explicit approval, never silently | Your concern: a drifting ledger is worse than none | Automation without visible diffs produces false confidence | [S-03](#s-03) | **Approved** |

---

## 2026-08-23 — Stack decisions

| ID | Type | Entry | Your input (paraphrased) | Why decided this way | Source | Status |
|----|------|-------|--------------------------|----------------------|--------|--------|
| L017 | DECISION | Modular monolith, single deployable | *"Modular monolith, single deployable (approved)"* | Your rewrite fear was misdiagnosed — what forces rewrites is tangled logic and no API boundary, not monolith-vs-microservices. Modules give you extraction seams without the cost. | [S-04](#s-04) | **Approved** |
| L018 | DECISION | All logic behind JSON APIs; web + mobile are both clients | *"yes I will go with your recommendation… api's are mandatory way that helps communication with frontend (web and mobile) to the backend"* | Your understanding is correct. This is the single thing that makes the future mobile app cheap instead of a rewrite. | [S-05](#s-05) | **Approved** |
| L019 | DECISION | Hosting: Railway Hobby | *"since you mentioning railway is cheaper i will plan to go with hobby plan as of now"* | ~$6–12/mo realistic; near-zero ops. **Caveat:** Hobby is a $5 *minimum spend*, not a cap — usage bills on top. | [S-06](#s-06) | **Approved** |
| L020 | DECISION | React + TypeScript + Tailwind, no component library; web first | *"reactjs, typescript, html5, tailwindcss only without any 3rd party component libraries… currently going with web application later i or other collaborator will build the mobile"* | Smaller bundle, no library lock-in | [S-07](#s-07) | **Approved** |
| L021 | DECISION | Next.js on Railway | *"Nextjs supported by railway? If yes no problem."* | **Answer: yes.** Railway's Nixpacks auto-detects Next.js. **Nothing to install on Railway** — push a repo with `package.json` and Railway builds it. No Dockerfile needed. | [S-08](#s-08) | **Approved** |
| L022 | DECISION | Railway managed Postgres | *"railway has postgres inbuilt"* | Standard PostgreSQL, not a fork → `pg_dump`/`pg_restore` works → free lift-and-shift, satisfying L025 | [S-09](#s-09) | **Approved** |
| L023 | DECISION | Supabase NOT used | *"supabase is coming with authentication"* | Supabase Auth would save ~2 weeks, **but** it stores identity in its own `auth` schema — the one thing that can't cleanly `pg_dump`. It directly contradicts your stated portability priority (L025). | [S-09](#s-09) | **Approved** |
| L024 | DECISION | Auth self-built (Argon2id + httpOnly sessions) | Inferred from L023, not stated by you | ~2 weeks work, highest-security surface in the project. **Needs your explicit yes.** | [S-09](#s-09) | ⚠️ **Awaiting confirm** |
| L025 | DECISION | Free, complete DB portability is a standing requirement | *"lift and shift of entire database should be free - which helps me to move faster to another platform if something happens"* | Elevated to a standing constraint: no vendor-specific persistence anywhere | [S-09](#s-09) | **Approved** |
| L026 | DECISION | Backups: nightly `pg_dump` → R2 | *"intially i dont need backup headaches, but later that must be supported - its my priority too"* | Deferred, not skipped. Since R2 is already in the stack, a cron'd `pg_dump` to R2 is ~20 lines, costs nothing, and the artifact is provider-independent. | [S-09](#s-09) | **Approved — Phase 1** |
| L027 | DECISION | Document storage: Cloudflare R2 | *"Option B can reach user expected feasibility"* | Free 10 GB, zero egress fees | [S-10](#s-10) | **Approved** |
| L028 | DECISION | Hybrid storage: text canonical in Postgres, PDF client-rendered, R2 only on explicit save | Refinement of L027 after your 150 KB figure | Text is **43× smaller** than PDF (3.5 KB vs 150 KB). Storing every PDF = ~54 GB/yr at 1,000 users; hybrid keeps you in R2's free tier far longer. | [S-11](#s-11) | ⚠️ **Awaiting confirm** |
| L029 | DECISION | Email provider: Brevo | *"if railway has any inbuilt service offered as free we utilize it otherwise you need to suggest"* | **Answer: Railway has no email service** — it's infrastructure, not BaaS. Brevo gives 300/day free (~300 users) vs Resend's 100/day (~100 users). | [S-12](#s-12) | ⚠️ **Awaiting confirm** |
| L030 | DECISION | Excluded: Kubernetes, Redis, microservices, managed DB, multi-service deploys | *"i am wondering does kubernetes help me out and its futuristic enough but i dont know"* | K8s floor is $60–100/mo before a single user, and solves horizontal multi-service scaling — a problem you don't have. Each extra Railway service is metered compute. | [S-13](#s-13) | **Approved** |

---

## 2026-08-23 — Sizing conclusions (canonical — do not re-derive)

You asked me to do this math ([S-11](#s-11)). These are now reference facts; future tasks cite them rather than recomputing.

| ID | Type | Conclusion | Basis | Status |
|----|------|-----------|-------|--------|
| L031 | ASSUMPTION | ~200 KB DB growth per user per month | 30 applications × 5 KB (JD ~4 KB dominates) + generations ~3.5 KB each + call logs ~1.5 KB | Modelled |
| L032 | ASSUMPTION | 1,000 users / 12 months → ~3.4 GB Postgres incl. indexes | L031 × 1,000 × 12, +40% index overhead | Modelled |
| L033 | ASSUMPTION | 1,000 users → ~2.5 writes/min, ~9 reads/min average | ~110 writes + ~375 reads per user/month | Modelled |
| L034 | DECISION | **Compute is not the constraint — Gemini Flash's 15 req/min burst is.** Requires a job queue with backoff. | At 1,000 users you use ~0.05% of a small Postgres instance. But 16 simultaneous generations exceed Gemini's per-minute limit, and each takes ~5s. | **Confirmed — Phase 2 requirement** |
| L035 | ASSUMPTION | Email ~30/user/month → Brevo free tier ≈ 300 users | Mostly follow-up reminders | Modelled |
| L036 | DECISION | Own send-queue required — reminders cluster and Brevo doesn't auto-queue past 300/day | Everyone's 7-day mark fires in the morning | **Confirmed — F4 requirement** |
| L037 | ASSUMPTION | Your figure: resume PDF 100–200 KB | *"i assume a resume can be 100KB to 200KB"* — used 150 KB in all calculations | [S-11](#s-11) |

---

## Open — blocking

| ID | Type | Question | Your input so far | Why it blocks | Source | Status |
|----|------|----------|-------------------|---------------|--------|--------|
| L038 | OPEN-QUESTION | **Does the app send follow-up emails to recruiters on the user's behalf, or only draft text for the user to copy?** | *"Yes app sends notifications when required by the features"* — this answers *notifications to the user*, not *emails to recruiters from the user's address* | Draft-and-copy = a textarea. Send-on-behalf = Gmail OAuth, token storage, refresh handling, **and Google's restricted-scope security review (~3–4 weeks)**. Changes F4's task count ~5×. | [S-14](#s-14) | 🔴 **Blocking F4** |
| L039 | OPEN-QUESTION | L024 — do you confirm self-built auth? | Implied, not stated | ~2 weeks + highest security surface | [S-09](#s-09) | 🔴 **Blocking F1** |
| L040 | OPEN-QUESTION | Email verification required before app use? | Not answered | Affects signup flow, `email_verified_at` column, and free-tier abuse (interacts with the 12-day trial) | — | 🔴 **Blocking F1** |
| L041 | OPEN-QUESTION | Capture user timezone at signup? | Not answered | Without it, every 7-day reminder fires at the wrong local time for Indian users. One column now vs a painful backfill later. | — | 🔴 **Blocking F1 + F4** |
| L042 | OPEN-QUESTION | A1–A6: session strategy, skills vocabulary, experience-level enum, is profile mandatory, email changeable, password policy | Not answered | Feature A schema can't be finalised | — | 🔴 **Blocking F1** |

---
---

# APPENDIX — Source quotes

Your verbatim words. Referenced by the `S-xx` links above.

### S-01
> *(From the workflow discussion — Phase 0 gating was raised by me as an open question derived from the PRD's own build plan, which states: "Resolve the WhatsApp group research before committing to Phase 1." You have not yet answered whether you accept that gate.)*

### S-02
> "now as you went through the instruction i pasted in starting prompt, I want you to modify them with all the necessary modifications you mentioned."

### S-03
> "i wonder it auto updated by the ai model after approval. Yes lets see."
>
> *(Context: responding to my note that "a ledger is only as good as your discipline in updating it. If it drifts from reality, it's worse than no ledger — false confidence.")*

### S-04
> "Architecture: Modular monolith, single deployable (approved)."
>
> Earlier concern that prompted the discussion:
> "i know monolithic approach is easy at start but once users increase i or other again need to rework from scratch on this which could be a waste of time and complete rework on architecture is required."

### S-05
> "Api Boundary: yes i will go with your recommendation. but for clarity - i understood you are saying api's are mandatory way that helps communication with frontend (web and mobile) to the backend."

### S-06
> "Hosting provider: since you mentioning railway is cheaper i will plan to go with hobby plan as of now"
>
> Earlier:
> "all of it is hosted on railway hosting platform with a hobby plan. I dont want to exceed out of that railway hobby plan."

### S-07
> "Trackr - Its a web and mobile application. I am currently going with web application later i or other collaborator will build the mobile application. I am wondering to go with reactjs, typescript, html5, tailwindcss only without any 3rd party component libraries for forntend, api's, middleware, backend, database postgres"

### S-08
> "Nextjs supported by railway? If yes no problem."
> "Doubt: do we need to explicitly install it on that railway?"

### S-09
> "Database: I dont know, but railway has postgres inbuilt. supabase is coming with authentication. Later on prod which costs me less i am willing to choose that. intially i dont need backup headaches, but later that must be supported - its my priority too. lift and shift of entire database should be free - which helps me to move faster to another platform if something happens on run in future."

### S-10
> "Document storage: Option B can reach user expected feasibility."
>
> *(Option B as offered = Cloudflare R2: generous free tier, zero egress fees, external dependency.)*

### S-11
> "read and write calculation - you need to do that math. i assume a resume can be 100KB to 200KB."

### S-12
> "Email provider: dont know, if railway has any inbuilt service offered as free we utilize it otherwise you need to suggest."

### S-13
> "I am wondering to go with... i am wondering still does kubernetes help me out and its futuristic enough but i dont know. i know monolithic approach is easy at start but once users increase i or other again need to rework from scratch on this... DigitalOcean 2cpu's plan 24$ approx, i am not sure whether that is enough."

### S-14
> "Yes app sends notifications when required by the features and entire application."
>
> *(Flagged as insufficient: "notifications" is ambiguous between (a) notifying the user, and (b) sending email to a recruiter from the user's address. The PRD says "App drafts a one-line follow-up email — user reviews and sends," which reads as draft-and-copy.)*

---

## How this ledger updates

- New rows appended only when you say **"approved"** or **"log this"** — never silently.
- Every update is shown to you as a diff summary in chat.
- Superseded entries get `SUPERSEDED — see L0xx`; the original row stays.
- Every decision carries a source link to your own words, so the reasoning is auditable without this conversation.
- **Note on links:** these are internal document anchors, not links back into the chat — Claude.ai has no per-message URLs, so the quotes are stored here instead. That makes the ledger self-contained and portable.

---

> **⚠️ HISTORICAL — restored 2026-08-25.** Second ledger version, introducing the
> source-quote appendix. Several entries here were later revised: L021 (Nixpacks →
> Railpack), L024 (confirmed as L039), L038 (resolved), L033 (15 req/min figure
> now disputed — see L066). **Use `DECISIONS.md` as the live ledger.**

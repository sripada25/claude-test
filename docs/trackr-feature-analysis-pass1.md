# Trackr — Feature Analysis Pass 1

Stack reconciliation · cross-cutting doubts · feature map · Feature A worked example

---

# PART 0 — BLOCKING: Your stack contradicts the PRD

The PRD (v0.1, 13 Aug 2026) specifies **Supabase + Vercel + React Native/Expo**.
You have now specified **Railway Hobby + React (web) + self-built API + Postgres**.

These are not compatible. What silently breaks:

| PRD assumed | Your stack | Consequence |
|---|---|---|
| Supabase Auth | none | **You must build auth yourself** — signup, login, sessions, password reset, email verification. This is a real feature, not a config step. Adds ~1 parent task + significant security surface. |
| Supabase Storage (resume PDFs) | none | Need Railway volume **or** external object storage (R2/S3). Volumes cost money and complicate deploys. |
| Supabase Row-Level Security | none | Every ownership check moves into your application layer. **Highest IDOR risk in the whole project.** |
| Vercel free hosting | Railway | Now a paid, usage-metered service |
| React Native + Expo | ReactJS web | Correct call for web-first. Mobile becomes a genuinely separate build later, not a re-export. |

## Railway Hobby — what it actually is

Railway pricing is usage-based; the plan price is only the minimum spend — Hobby starts at $5/month, and CPU, memory, volumes, and network egress are billed on top. Hobby includes $5/mo in credits covering RAM, CPU and storage; usage over credits is billed separately.

**So "don't exceed Hobby" is a budget ceiling, not a hard technical cap.** Nothing stops you at $5 — you just get billed more. Realistic figure: a Node app paired with a Postgres database on Hobby typically runs $6–12/month once database memory and storage are counted.

**Architectural consequence — this is the single most important constraint on the whole build:**

Every additional Railway *service* is additional metered compute. To stay near the $5 floor:

- **One** app service (serves React build + API), **one** Postgres. That's it.
- **No Redis.** Rate limiting and job state go in Postgres.
- **No separate worker service.** Reminders run via in-process scheduler or Railway Cron.
- **PDFs are the storage risk.** Volume storage is billed and grows monotonically.

> `[DECISION REQUIRED] D-01` — **Backend runtime.** You said "APIs, middleware, backend" but named no runtime.
> - **Option A: Next.js (App Router) full-stack** — one service, React + API routes together, cheapest on Railway, TypeScript end-to-end. Trade-off: less separation between frontend and API.
> - **Option B: React SPA (Vite) + separate Node/Express + TypeScript API** — cleaner boundaries, matches your "APIs, middleware, backend" wording literally. Trade-off: two services = roughly double the compute cost.
> - **Recommendation: Option A.** It is the only one that comfortably fits a $5–8/month ceiling, and it does not prevent you from extracting a standalone API later when the mobile app needs one.

> `[DECISION REQUIRED] D-02` — **PDF/document storage.**
> - Option A: Railway volume — simple, metered, grows forever, awkward on redeploys.
> - Option B: Cloudflare R2 — free tier is generous, zero egress fees, external dependency.
> - Option C: **Don't store PDFs at all.** Store the generated *text* in Postgres; render the PDF client-side on demand.
> - **Recommendation: Option C for MVP.** Text is small, versionable, searchable, and costs nothing. Zero storage bill, zero file-upload attack surface.

---

# PART 1 — Cross-cutting doubts (answer before feature work)

| # | Doubt | Why it matters |
|---|---|---|
| Q1 | Email sending — which provider? (Resend / SES / Postmark) | Blocks: email verification, password reset, follow-up emails. Not optional. |
| Q2 | Does the app **send** the follow-up email, or just draft it for the user to copy/send themselves? | PRD says "user reviews and sends" — ambiguous. Sending on behalf needs OAuth to Gmail, a whole extra feature. Huge scope difference. |
| Q3 | Email verification required before use, or optional? | Affects signup flow, DB (`email_verified_at`), and abuse risk on the free tier. |
| Q4 | Password reset in MVP — yes/no? | Reasonable to defer, but users *will* need it. |
| Q5 | Social login (Google) in MVP? | Recommend **no** — adds OAuth complexity for little MVP value. |
| Q6 | Multi-currency: is salary expectation stored with a currency code? | India + international users. Storing a bare number is a permanent data mistake. |
| Q7 | Account deletion — required? | India's DPDP Act and GDPR both point to yes. Affects every table's deletion graph. |
| Q8 | Timezone handling — is "7 days after application date" computed in the user's local timezone or UTC? | Reminders will fire at wrong times for Indian users if this is UTC-naive. |
| Q9 | Is the 12-day trial per-account or per-email? | Trivially abusable if per-account with no verification. Interacts with Q3. |
| Q10 | Gemini Flash API key — one shared server-side key for all users, correct? | Assumed yes. Must **never** touch the client. |
| Q11 | What happens to Pro users' data when they downgrade? | Recommend: keep everything, only block *new* generation. |
| Q12 | Soft-delete on applications (recoverable) or hard delete? | Affects every FK and the deletion graph. |

---

# PART 2 — Feature map & dependency graph

```
F1 User Accounts (auth + profile)
      ↓ everything depends on this
F2 Application Tracker
      ↓                    ↓
F3 AI Generation      F5 Post-Call Quick Log
      ↓                    ↓
      └──→ F4 Follow-up System ←──┘
                 ↓
F6 Payments  (gates F3's generation counter; F1 displays its status)
```

| ID | Feature | Depends on | Notes |
|---|---|---|---|
| F1 | User Accounts | — | Foundation. Nothing ships before this. |
| F2 | Application Tracker | F1 | The spine. PRD: "every interaction connects to a single application record." |
| F3 | AI Generation | F1, F2, **F6 (counter)** | Needs a JD from F2 and a profile from F1. |
| F4 | Follow-up System | F2, F3 | Reminders hang off applications; drafting reuses F3's Gemini plumbing. |
| F5 | Post-Call Quick Log | F2, F3 | Same Gemini plumbing; writes a call log + a reminder. |
| F6 | Payments | F1 | **Can be built last but must be stubbed early** — F3 cannot enforce quota without a tier concept. |

**Circular-dependency warning:** F3 needs F6's tier, F6 needs nothing from F3. Break it by shipping a **`subscription` table with a hardcoded `free`/`pro` enum in F1**, and wiring real billing in F6. F3 reads the column, not the payment provider.

---

# PART 3 — FEATURE A (F1): USER ACCOUNTS

## Doubts asked

| # | Doubt |
|---|---|
| A1 | Session strategy — httpOnly cookie session vs JWT? |
| A2 | Are `skills` free-text tags or a controlled vocabulary? |
| A3 | Is `experience_level` an enum or free text? |
| A4 | Is the profile mandatory before using the tracker? |
| A5 | Can a user change their email after signup? |
| A6 | Minimum password policy? |

## My understanding

A user signs up with email + password, is issued a session, and fills a structured profile. That profile is the **permanent left-hand input to every AI generation call** — not decorative account metadata, a product input.

The critical reframe versus the PRD: **this is no longer "wire up Supabase Auth."** With Railway you are building an identity system. Password hashing, session management, timing-safe comparison, rate limiting, and ownership enforcement are all now *your* code and *your* liability.

## My notes

- Profile completeness is a **product** gate. An empty profile produces garbage cover letters.
- `salary_expectation` must be `(amount, currency, period)` — never a bare integer.
- `timezone` belongs on the user row, captured at signup from the browser.
- Subscription status here is **read-only display**. All writes belong to F6.

## Task decomposition (5 parent tasks, 17 subtasks)

**P1 — Identity data foundation:** T1.1 `users` table · T1.2 password hashing module · T1.3 `sessions` table + service

**P2 — Auth API:** T2.1 signup · T2.2 login (non-enumerating) · T2.3 logout · T2.4 rate limiting · T2.5 session middleware

**P3 — Profile domain:** T3.1 `profiles` table · T3.2 `GET/PUT /api/profile` · T3.3 completeness rule

**P4 — Subscription read model:** T4.1 `subscriptions` stub · T4.2 read endpoint

**P5 — Frontend:** T5.1 signup/login pages · T5.2 auth state + route guard · T5.3 profile builder · T5.4 subscription badge

## Things you didn't mention that matter

1. **Account deletion** — legally expected under DPDP. Cheapest to design now.
2. **`timezone` on the user row** — without it, F4's reminders fire at wrong local times.
3. **A `generation_quota` concept separate from `subscriptions`** — billing period ≠ quota period.
4. **Structured audit of auth events** — cheap now, invaluable later.
5. **Secrets handling** — all in env vars, never in the repo or client bundle.

---

# PART 4 — Cost reality check for F1

Nothing in F1 adds recurring cost beyond the base app + Postgres. Rate limiting in Postgres instead of Redis avoids a second service (~$5+/mo saved). F1 keeps you at the $5–8/month band.

---

# PART 5 — What I need from you to continue

**Blocking:** `D-01` backend runtime · `D-02` document storage · `Q1, Q2, Q3, Q8`
**Feature A specific:** `A1–A6`
**Nice to have:** `Q4–Q7, Q9–Q12`

---

> **⚠️ HISTORICAL — restored 2026-08-25.** Written before the stack was settled.
> Several conclusions have since been superseded:
> - `D-01` resolved → Next.js (L021)
> - `D-02` resolved → R2 + hybrid text storage (L027, L028)
> - `Q5` social login **reversed** → SSO is now in MVP (L068)
> - The 5-parent/17-subtask breakdown is superseded by `TASKS.md` (8 groups, 35 tasks)
> - Task IDs here do **not** match `TASKS.md`
>
> Kept for history — the feature dependency graph in Part 2 remains accurate and
> is still the basis for build order. **Use `FEATURE-A-SPEC.md` and `TASKS.md` as live.**

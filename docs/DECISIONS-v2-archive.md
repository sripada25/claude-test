# Trackr — Decision Ledger (v2 archive)

> **⚠️ HISTORICAL — restored 2026-08-25.** This was `DECISIONS.md` before the v3
> restructure into Part 1 (at-a-glance) + Part 2 (four-part records). Superseded by
> the current `DECISIONS.md`. Kept for history.
>
> **Reconstruction note:** this file was built incrementally through many edits.
> The restoration is faithful in content but may differ in minor ordering from the
> exact final state before deletion.

Current state only. Full verbatim exchanges live in `../sessions/`.

---

## Approved — AI pipeline, portability & privacy · 2026-08-24

| ID | Decision | Why |
|----|----------|-----|
| L059 | **Free Gemini tier during development only.** Switch to paid before the first real user uploads a real resume. | The training clause applies to whatever is sent, regardless of user count. A resume is name + phone + email + address + employment history — exactly what DPDP governs. ~$10/month. |
| L060 | **Provider-agnostic AI layer.** One `AIProvider` interface · thin per-provider adapters · prompts as versioned DB templates · every document stamped with `provider` + `model`. | Already 80% safe because L028 stores plain text. Lock-in risk is in code, not data. ~200 lines now vs touching every call site later. |
| L061 | **REVISION of L048: drop `pdf-parse`.** Send the PDF directly to Gemini. | Gemini processes PDFs with native vision — scanned resumes and screenshots-in-PDFs work with zero extra tooling. Native text tokens aren't charged; image pages cost 258 tokens each (~$0.00015 for a 2-page scan). |
| L062 | Free tier: view/copy text in-app only. Pro: PDF download. | Improves storage economics — R2 usage accrues only from paying customers. |
| L063 | **Known Gemini vision limits:** may hallucinate on handwritten text; not spatially precise. | The mandatory review step (L049) already covers this. |
| L064 | **Data minimization baseline.** Never log prompt contents or generated documents · delete uploaded resume files after extraction · account deletion must cascade · purpose limitation · Brevo send-only, never sync contacts · payments via hosted checkout. | Third parties touching user data: Gemini, Railway, R2, Brevo, Razorpay/Stripe. |
| L065 | **Tension noted, not resolved:** L029 asks for maximum privacy; L059 chooses the free tier. | Zero third-party sharing is impossible with any AI API. What's controllable is minimization and disclosure. |

## Approved — Follow-up & AI provider · 2026-08-24

| ID | Decision | Why |
|----|----------|-----|
| L038 | **Option A (draft + copy) free tier, Option B (Brevo send with `Reply-To`) Pro.** Option C rejected. | The PRD's stated value is the drafting, not the transport. |
| L054 | Drafting free, sending Pro | Sending costs real money and is the higher-value action. |
| L055 | **Follow-up drafts do NOT count against the 5/month quota** | One line vs a full letter. Counting them makes users ration follow-ups — the behaviour the product exists to encourage. |
| L043 | **Dockerfile at repo root instead of Railpack** | Railpack is Railway-exclusive; Dockerfile is auto-detected and takes priority. Satisfies L025. |
| L056 | **CORRECTION:** `gmail.send` is a **sensitive** scope, not restricted. No security assessment — review + demo video only. | My earlier "restricted-scope security review" claim was wrong and would have pushed the decision on false grounds. |
| L057 | **Gemini paid tier from day one — not free.** | The free tier trains on prompts; paid does not. Contradicts the PRD's *"Telemetry on application content — User data is private."* |
| L058 | AI budget ~$10–30/month at MVP scale | ~$0.002 per generation. 1,000 users × 5 generations ≈ $10/month. |

## Approved — Feature A (User Accounts) · 2026-08-24

| ID | Decision | Why |
|----|----------|-----|
| L039 | Auth self-built (Argon2id + httpOnly sessions + server-side `sessions` table) | Railway provides no session strategy. Sessions live in your Postgres + code, so moving platforms requires zero rework. |
| L040 | Email verification — before first AI generation, not before signup | Gates where cost and abuse live without killing activation. |
| L041 | Capture user timezone at signup | Without it every 7-day reminder fires at the wrong local hour. |
| L044 | httpOnly cookie + server-side session table, not JWT | Revocable. |
| L045 | Skills as free-text `text[]`, lowercase-normalized | PRD names `skills` but never specifies storage. In MVP skills only feed the Gemini prompt. |
| L046 | `experience_level` enum: Junior / Mid / Senior / Lead | Feeds prompt construction. |
| L047 | **Profile mandatory before app access.** signup → profile → complete → access | Removes the "gate generation on completeness" complexity. |
| L048 | Resume auto-fill via hybrid pipeline (later revised by L061) | Cost fear was inverted: parsing is ~1 call per user ever vs generation at ~5,000/month. |
| L049 | Parse output never saved blind; review mandatory | The review pass guarantees no garbage. |
| L050 | **Two email fields:** `users.email` (login) and `profiles.contact_email` (documents, Reply-To) | Your catch. Most tools conflate these. |
| L051 | Email changeable, with re-verification | Basic expected feature. |
| L052 | Password: min 12 chars, no complexity rules, no breach-check | Length beats symbol-soup. |
| L053 | **PRD Phase 0 does not gate the build.** Run validation in parallel with F1/F2. | F1 and F2 are required in every scenario, including a pivot. |

## Approved — Stack

| ID | Decision | Why |
|----|----------|-----|
| L017 | Modular monolith, single deployable | Rewrites are caused by tangled logic and missing API boundaries, not monoliths. |
| L018 | All logic behind JSON APIs; web + mobile are peer clients | Makes the future mobile app cheap instead of a rewrite. |
| L019 | Railway Hobby hosting | ~$6–12/mo realistic. Hobby is a minimum spend, not a cap. |
| L020 | React + TypeScript + Tailwind, no component library; web first | Small bundle, no library lock-in. |
| L021 | Next.js on Railway | Auto-detected and built on push. |
| L021a | **Correction:** builder is Railpack, not Nixpacks | Railpack replaced Nixpacks 2026-03-04. |
| L022 | Railway managed Postgres | Standard PostgreSQL → `pg_dump` works. |
| L023 | Supabase not used | Its `auth` schema can't cleanly `pg_dump`. |
| L025 | **Free, complete DB portability — standing requirement** | No vendor-specific persistence anywhere. |
| L026 | Backups: nightly `pg_dump` → R2, Phase 1 | ~20 lines, costs nothing, provider-independent. |
| L027 | Document storage: Cloudflare R2 | Free 10 GB, zero egress. |
| L030 | Excluded: Kubernetes, Redis, microservices, managed DB, multi-service | K8s floor is $60–100/mo before a single user. |

## Approved — Workflow

| ID | Decision | Why |
|----|----------|-----|
| L015 | Allow-list scoping + version-pinned approval | Deny-lists implicitly permit everything unlisted. Approval binds to a git SHA. |
| L016 | Ledger updated only on explicit approval | A drifting ledger produces false confidence. |

## Sizing — canonical

| ID | Conclusion |
|----|-----------|
| L031 | ~200 KB DB growth per user per month |
| L032 | 1,000 users / 12 months → ~3.4 GB Postgres incl. indexes |
| L033 | 1,000 users → ~2.5 writes/min, ~9 reads/min (~0.05% of a small instance) |
| L034 | **Compute is not the constraint — Gemini's 15 req/min burst is** |
| L035 | Email ~30/user/month → Brevo free tier ≈ 300 users |
| L036 | Own send-queue required |
| L037 | Resume PDF assumed 150 KB |

## Open at time of archive

| ID | Question | Blocks |
|----|----------|--------|
| L066 | Verify real Gemini quota in AI Studio console | F3, F4, F5 |
| L029 | Confirm Brevo | F4 |

## Superseded

| ID | Was | Now |
|----|-----|-----|
| L002 | Android MVP first | L020 — web first |
| L012 | React Native + Expo | L020 — React web |
| L007 | "Gemini free tier sufficient" | L034 — burst limit is the real constraint |
| L024 | Auth self-built (inferred) | L039 — confirmed |
| L048 | `pdf-parse` → Gemini | L061 — PDF straight to Gemini |

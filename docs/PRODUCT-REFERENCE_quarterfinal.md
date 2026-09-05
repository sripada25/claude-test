# PRODUCT-REFERENCE_quarterfinal.md — Trackr

The master chain: **PRD → Feature → Tasks → Ledger → Database → Screens → Components.**

Absorbs and retires `FEATURE-A-SPEC.md` (F1's narrative) and `F1-READINESS.md` (status checking). Both remain in the repo as historical record; this document is the current one.

**This is the entry point.** Read this first to know which document owns what, then go to the specific document for detail. This file summarizes; it does not duplicate.

---

# 1 · HOW TO READ THIS PROJECT

```
Trackr — Product Documentation v0.1 (PRD)
        ↓
DECISIONS_quarterfinal.md          — every decision made since, why, what would reopen it
        ↓
DATABASE_quarterfinal.md           — the schema those decisions produced
SECURITY_quarterfinal.md           — the threat model and controls
        ↓
TASKS_quarterfinal.md              — backend work, decomposed, dependency-ordered
TASKS-FRONTEND_quarterfinal.md     — frontend work, screen-wise, component-level
        ↓
CLAUDE.md                          — the rules an implementing agent follows
```

**One owner per fact.** If two documents disagree, the specialised one wins for its own domain — schema questions resolve to `DATABASE_quarterfinal.md`, not to a task description that mentions a column in passing.

---

# 2 · PRD → FEATURE MAP

| Feature | PRD reference | Status |
|---|---|---|
| **F1** User Accounts | p.13 "User accounts" | ✅ Fully specified — 34 backend tasks, 12 screen-note components |
| **F2** Application Tracker | p.13 "Application tracker" | ✅ Fully specified — 14 backend tasks, 30 screen-note components |
| **F3** AI Generation | p.13 "AI generation" | ✅ Rules specified (`AI-RULES.md`), 12 UI components (M06). No dedicated task breakdown yet — folded into F1/F2 tasks that touch it (T5.1–T5.4, F2-2.x) |
| **F4** Follow-up System | p.13 "Follow-up system" | ✅ Fully specified — 9 backend tasks. 🔴 One open decision (L038) gates 3 of them |
| **F5** Post-Call Quick Log | p.13 "Post-call quick log" | ⏸ Wireframe only (plate 07). Prompt spec exists (`AI-RULES.md` §6.1). No tasks |
| **F6** Payments | p.13 "Payments" | ⏸ Provider decided (Razorpay, INR-only). No schema, no tasks, no design. Nine open questions |
| **F0** Marketing & Support | Not in PRD — added during planning | ✅ 11 tasks specified |

**Retracted from PRD, confirmed still out of scope:** job search/matching engine, ATS scoring, local AI, iOS call recording in MVP (`DECISIONS_quarterfinal.md` L001–L006).

---

# 3 · FEATURE STATUS DASHBOARD

Replaces the single-point-in-time `F1-READINESS.md`. This table is designed to be re-read, not regenerated — check the source documents' own dates for currency.

## F1 — User Accounts

| | |
|---|---|
| **Backend** | 34 tasks, `TASKS_quarterfinal.md` §F1. All dependencies resolved. |
| **Frontend** | 12 components (Sidebar ×4 + M01 ×12 — wait, see exact count below), all pen-verified |
| **Schema** | Complete — `DATABASE_quarterfinal.md` §2 |
| **Security** | 10 OWASP gaps closed, `SECURITY_quarterfinal.md` §2–§12, §15–§17 |
| **Blocking** | L074 (LinkedIn Page) blocks only T4.4. Nothing else blocks F1. |

**Frontend exact count:** Sidebar (4) + M01 (12) + M02 (8) = 24 components in F1's screens, per `TASKS-FRONTEND_quarterfinal.md`.

## F2 — Application Tracker

| | |
|---|---|
| **Backend** | 14 tasks, `TASKS_quarterfinal.md` §F2 |
| **Frontend** | M03 (13) + M04 (6) + M05 (10) = 29 components |
| **Schema** | Complete — `DATABASE_quarterfinal.md` §3 |
| **Security** | Soft-delete discipline (L123) is F2's dominant risk — 2 tests specifically target it |
| **Blocking** | Nothing |

## F3 — AI Generation

| | |
|---|---|
| **Rules** | Complete — `AI-RULES.md`, all 5 operations specced (résumé extraction, cover letter, résumé tailoring, call notes, follow-up drafts) |
| **Frontend** | M06 (9 components), `TASKS-FRONTEND_quarterfinal.md` |
| **Backend** | ✅ **17 tasks, `TASKS_quarterfinal.md` §F3** — migrations for `documents`/`generation_jobs`/`ai_usage`, the generation endpoint, quota enforcement, retry policy, output validation |
| **Blocking** | Depends on F1's T5.1 (`AIProvider`) and F2's `applications` table — both must be merged first |
| **Highest-risk tasks** | F3-2.2 (résumé tailoring — must reject fabricated content, not save it) · F3-2.5 (quota decrement — a bug here is a billing event) |

## F4 — Follow-up System

| | |
|---|---|
| **Backend** | 9 tasks, `TASKS_quarterfinal.md` §F4, full detail in `F4-TASKS.md` |
| **Frontend** | No mockup (plate 08 is wireframe-only). Structure specced, not pixel-verified |
| **Schema** | Complete — `DATABASE_quarterfinal.md` §3.3 |
| **Blocking** | 🔴 L038 (copy-only vs Pro send) gates 3 of 9 tasks. Evidence is one-sided toward copy-only — see the ledger record |

## F5 — Post-Call Quick Log

| | |
|---|---|
| **Design** | Wireframe only (plate 07) |
| **Rules** | Prompt spec exists — `AI-RULES.md` §6.1 |
| **Tasks** | None written |
| **Status** | Not started |

## F6 — Payments

| | |
|---|---|
| **Provider** | Razorpay confirmed, INR-only, `PaymentProvider` interface pattern planned (mirrors `AIProvider`) |
| **Design** | ✅ **Substantially specified as of 2026-08-27** — see `SCREEN-NOTES-F6-PAYMENTS.md`. Settings & Plan screen, Upgrade checkout modal (billing cycle toggle, Razorpay-hosted redirect), Verifying-payment state (addresses the webhook confirmation race), Payment Failed state (⚠️ draft copy, needs designer revision), Subscription Expiry (❌ **confirmed unfinished** — fully read, contains no expiry-specific content) |
| **Architecture resolved** | Checkout is a **redirect to Razorpay-hosted payment** — Trackr never touches card details. Confirmation requires **polling or real-time status check** after redirect-back, because Razorpay confirms to the browser before the webhook reaches the server |
| **Open questions** | Downgrade behaviour (confirmed undesigned — Subscription Expiry screen exists but is empty) · refunds · cancellation flow (mentioned in copy, not designed) · GST invoicing · webhook idempotency (design, not implementation) · annual↔monthly mid-cycle switching |
| **Status** | Checkout flow substantially designed. 6 new backend tasks (F6-1 to F6-6) in `TASKS_quarterfinal.md`. Still last in the build order — the `subscriptions` stub in F1 continues to unblock everything downstream |

## F0 — Marketing & Support

| | |
|---|---|
| **Backend** | 11 tasks, all local-complete or config-only |
| **Design** | None — no mockup, no wireframe |
| **Status** | Structurally specified (route groups, page list), visually unspecified |

---

# 4 · F1 NARRATIVE (absorbed from `FEATURE-A-SPEC.md`)

The original spec framed F1's core insight, which remains true and worth stating once, here, rather than in a file with a stale banner:

> **The profile is not account metadata — it is the permanent left-hand input to every AI generation call.** An empty profile produces unusable cover letters, which is the fastest way to lose a user. That's why L047 makes it mandatory, and why L098's "skip with consequence" design (AI features disabled until complete) exists rather than a hard gate on app access.

**Three artifacts from F1 are load-bearing across the whole system** — get them right once, four later features inherit correctness:

1. **Session middleware (T2.3)** — the sole point identity is established. Every authorization check in Trackr depends on it.
2. **`AIProvider` interface (T5.1)** — reused by F3, F4's draft generation, and F5. A leaky abstraction here means provider lock-in everywhere.
3. **`users.timezone` (T1.2)** — F4's entire scheduler (both R1 and R2) is silently wrong without it.

**The domain model, unchanged from the original spec:**

```
User (identity)
 ├─1:1─ Profile          (product input — feeds all generation)
 ├─1:1─ Subscription     (tier; read-only in F1, written by F6)
 ├─1:1─ GenerationQuota  (monthly counter; separate cycle from billing)
 ├─1:*─ Session
 ├─1:*─ VerificationToken
 └─1:*─ OAuthAccount     (added post-mockup-review, L068)
```

**Why quota is separate from subscription:** the quota cycle is the calendar month; the billing cycle is the subscription anniversary. Merging them means a user who subscribes on the 20th gets a quota reset on the 20th — wrong, and expensive to unpick after the fact.

---

# 5 · DOCUMENT OWNERSHIP MAP

| Question | Owning document |
|---|---|
| Why was X decided? | `DECISIONS_quarterfinal.md` |
| What are the exact words that led to it? | `DECISIONS.md` / `DECISIONS-MOCKUP-REVIEW.md` (historical) · `sessions/` |
| What tables exist? | `DATABASE_quarterfinal.md` |
| Who can read this table? | `DATABASE-SECURITY.md` |
| What's the threat model? | `SECURITY_quarterfinal.md` |
| What does the AI provider do, exactly? | `AI-RULES.md` |
| Where does this backend code go? | `BACKEND.md` |
| What's the exact pixel spec for this component? | `SCREEN-NOTES-M0x.md` |
| What's the reusable component contract? | `FRONTEND-COMPONENTS_quarterfinal.md` |
| What's the full frontend task, self-contained? | `TASKS-FRONTEND_quarterfinal.md` |
| What's the backend task? | `TASKS_quarterfinal.md` |
| How does the board's drag actually work? | `BOARD-COMPONENT.md` |
| What does F4 need that doesn't exist yet? | `F4-TASKS.md`, `F4-SCREEN-MAP.md` |
| What does F6's checkout flow look like? | `SCREEN-NOTES-F6-PAYMENTS.md` |
| How do I deploy this safely? | `SECURITY_quarterfinal.md` §17, `PLATFORM.md` |
| What does the user-facing privacy policy say? | `PRIVACY.md` |
| A user reports a failure — where do I look? | `SUPPORT.md` |
| How do I set up my machine? | `SETUP.md` |
| What's the Git/PR workflow? | `GIT.md`, `ISSUES.md` |

**Retired into this document:** `FEATURE-A-SPEC.md` (§4 above), `F1-READINESS.md` (§3 above). Both remain in the repo, superseded, not deleted.

---

# 6 · TRACEABILITY — ONE FULL CHAIN, AS AN EXAMPLE

To show the chain actually works end to end, here is one requirement traced completely.

**PRD (p.13):** *"Automatic 7-day follow-up reminder after application date"*

```
PRD p.13
   ↓
DECISIONS_quarterfinal.md L119
   "Two reminder rules... R1 fires date_applied + 7 days"
   — also surfaces R2 (post-interview), which the PRD implies (p.8) but
     no earlier feature list captured
   ↓
DECISIONS_quarterfinal.md L121
   "7-day window is fixed, not configurable, for MVP" — verified against
   5 independent sources including the Settings screen's lack of a
   duration control
   ↓
DATABASE_quarterfinal.md §3.3
   reminders table, reminder_type enum ('application_followup',
   'post_interview'), UNIQUE(application_id, type)
   ↓
TASKS_quarterfinal.md F4-2.1
   "Reminder scheduler — both rules, hourly" — depends on F4-1.1
   ↓
F4-TASKS.md §3
   Full scheduler SQL, idempotency via ON CONFLICT DO NOTHING,
   timezone-correct due_at computation
   ↓
SECURITY_quarterfinal.md test #17
   "A snoozed reminder does not resurface the tag before expiry"
```

**Nine steps, one requirement, no gap.** This is the standard every feature should meet. F3 now meets it too, as of this session — `AI-RULES.md`'s rules, `DATABASE_quarterfinal.md` §4's schema, and `TASKS_quarterfinal.md` §F3's 17 tasks are now a connected chain. F5 is the feature that currently doesn't — wireframe only, no tasks.

---

# 7 · OPEN ITEMS — CONSOLIDATED

Pulled from every document. This is the single list to work through.

## 🔴 Blocking

| ID | Item | Blocks |
|---|---|---|
| L074 | LinkedIn company Page not yet created | T4.4 only |
| — | **Pro send-path design** — L038 is *decided* (both tiers), but confirmation/sent/failure states don't exist | 3 of F4's 9 tasks |
| — | **`contact_email` verification** before use as Reply-To — now required, since the Pro send path is confirmed | F4 send path |

## 🟠 Needed before the relevant feature proceeds

| | Item | Feature |
|---|---|---|
| — | R2 window: 24h or 48h (PRD says "24–48") | F4 |
| — | Does R2 fire if `interview_at` was never set? | F4 |
| — | `contact_email` verification before Reply-To use | F4 (now required — L038 confirmed the send path) |
| — | F5 needs mockups before component-level tasks | F5 |
| — | F6's remaining open questions — refunds, cancellation, GST invoicing, mid-cycle switching | F6 |
| — | **Subscription Expiry screen exists but is empty** — confirmed via full read, needs the designer to actually build it | F6 |
| — | **Payment Failed screen — draft copy, no retry button**, needs designer revision | F6 |
| — | Cancellation flow — referenced in checkout copy, never designed | F6 |

## 🟡 Designer

Focus state · disabled state · error state · top bar height (proposing 64px everywhere) · result-card salutation/signoff parsing (proposing uniform render).

## 🔵 Legal

`PRIVACY.md` needs lawyer review · Grievance Officer must be named · retention periods need confirming (only `auth_attempts` at 90 days is settled).

## Admin panel (B)

Scoped in conversation, deliberately deferred — its own task list not yet started, per your instruction to leave it.

---

# 8 · WHAT THIS DOCUMENT DOES NOT DO

- **Does not duplicate schema, tasks, or component specs.** Every section above summarises and points; the detail lives in its owning document.
- **Does not resolve open items.** It collects them from across the project so nothing is only visible inside a document nobody's currently reading — the exact failure mode found repeatedly during the mockup and pen.dev review.
- **Is not a replacement for `CLAUDE.md`.** `CLAUDE.md` is what an implementing agent reads every session; this document is what a human reads to understand the whole shape of the project before diving into any one file.

---

# 9 · NEXT STEP

`CLAUDE.md`'s document map still points at `FEATURE-A-SPEC.md`, which this document now supersedes. That's the one live reference that needs updating — everything else pointing at the retired files is itself already-superseded and doesn't matter.

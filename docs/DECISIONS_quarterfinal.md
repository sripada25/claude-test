# DECISIONS_quarterfinal.md — Trackr Decision Ledger

**Merges** `DECISIONS.md` (L001–L089) and `DECISIONS-MOCKUP-REVIEW.md` (L090–L112) into one ledger, and adds L113–L124 from work since — F4's post-interview rule, the trust-proxy/P9 resolution, and corrections found along the way.

Both source files are unchanged and remain as historical record. This is the current, complete ledger.

Two zoom levels: **Part 1** — scan in 60 seconds. **Part 2** — full four-part records for decisions with history worth keeping.

```
docs/
  DECISIONS_quarterfinal.md    ← this file, current
  DECISIONS.md                 ← historical, L001–L089
  DECISIONS-MOCKUP-REVIEW.md   ← historical, L090–L112
  F4-TASKS.md · P9-IMPLEMENTATION.md   ← source for L119–L124
  sessions/
    2026-08-23-stack.md · 2026-08-24-feature-a.md   ← frozen
```

---
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
| L088 | PostgreSQL 16 in both environments — Railway's provisioning default | ✅ |
| L089 | Backup job runs INSIDE the app container, not as a separate service | ✅ |
| L027 | Document storage: Cloudflare R2 | ✅ |
| L028 | Text canonical in Postgres; PDF client-rendered; R2 on explicit save | ✅ |
| L062 | Free tier: view/copy only · Pro: PDF download | ✅ |
| L067 | Develop locally first; deploy later | ✅ |

## Identity & access

| ID | Decision | Status |
|----|----------|--------|
| L039 | Self-built auth — Argon2id + server-side sessions | ✅ |
| L044 | httpOnly cookie + `sessions` table, not JWT | ✅ |
| L052 | Password: min 12 chars, no complexity rules | ✅ |
| L068 | SSO: Google (MVP) + LinkedIn (after Page exists) | ✅ |
| L069 | Account linking: auto-link on verified email, invalidate unverified password | ✅ |
| L070 | SSO-only users can set a password — never strand a user | ✅ |
| L071 | Verification by OTP, not magic link | ✅ |
| L040 | Verification required — gates first AI generation | ✅ |
| L041 | Timezone captured at signup | ✅ |
| L050 | Two emails: `users.email` (login) vs `profiles.contact_email` (Reply-To) | ✅ |
| L051 | Email changeable, with re-verification | ✅ |
| L082 | Google SSO pre-fills **name only** — no photo, no other claims | ✅ |
| L118 | **Session: 24-hour absolute expiry, never sliding** | ✅ NEW |

## Profile & AI

| ID | Decision | Status |
|----|----------|--------|
| L045 | Skills as `text[]`, lowercase-normalized | ✅ |
| L047 | Profile mandatory before app access | ✅ |
| L048→L061 | Revised — PDF straight to Gemini, no `pdf-parse` | ✅ |
| L049 | Parse output never saved blind — review mandatory | ✅ |
| L060 | Provider-agnostic `AIProvider` interface | ✅ |
| L057 | Gemini paid tier before first real user (privacy) | ⚠️ tension — see L065 |
| L059 | Free tier during local development only | ✅ |
| L058 | AI budget ~$10–30/month at MVP scale | ✅ |
| L101 | `profiles.current_role` column added | ✅ |
| L102 | `location_preference` enum: remote/hybrid/onsite | ✅ |
| L106 | Gemini structured output mode for extraction | ✅ |
| L107 | Experience = years + months (SMALLINT ×2). **Enum dropped** | ✅ |
| ~~L046~~ | ~~`experience_level` enum~~ — **superseded by L107** | ❌ superseded |

## Application tracker (F2)

| ID | Decision | Status |
|----|----------|--------|
| L090 | JD stays editable; copy-on-write into `documents.jd_snapshot` | ✅ |
| L091 | Generation is asynchronous — save returns immediately, job queued | ✅ |
| L092 | Quota decremented atomically at enqueue, refunded on failure | ✅ |
| L094 | Queue depth cap: 2 free · 5 Pro, rejected with a message | ✅ |
| L095 | Profile and JD snapshotted onto the job at enqueue | ✅ |
| L096 | 2 attempts, split by error class — no retry on 400/safety/validation | ✅ |
| L103 | JD capped at 15,000 characters, DB-enforced | ✅ |
| L104 | Stage enum value `assessment`; UI may abbreviate to "Assess" | ✅ |
| L110 | `source` enum **and** `source_url`; scheme allow-list on URLs | ✅ |
| L113 | **Soft delete → trash → immediate hard delete on empty** | ✅ NEW |
| L114 | **Source field collected in M04**, pre-filled from `source_url` domain | ✅ NEW |
| L115 | **Card tags capped at 2 visible + `+N` overflow** | ✅ NEW |
| L116 | **Document persisted on generation**, not on "Save to application" | ✅ NEW |

## Follow-up system (F4)

| ID | Decision | Status |
|----|----------|--------|
| L038 | Free = draft+copy · **Pro = automatic send on click, `Follow up` control on the card** — confirmed | ✅ confirmed, send-path design pending |
| L054 | Drafting free, sending Pro (if L038's Pro path is kept) | ⚠️ |
| L055 | Follow-up drafts don't consume generation quota | ✅ |
| L099 | Forgot password = OTP, never a temporary password by email | ✅ |
| L119 | **Two reminder rules: R1 application follow-up (7d), R2 post-interview (24h)** | ✅ NEW |
| L120 | **Snooze hides the `Follow up` tag; a failed send does not** | ✅ NEW |
| L121 | **7-day window is fixed, not configurable, for MVP** | ✅ NEW |

## Email & payments

| ID | Decision | Status |
|----|----------|--------|
| L029 | Email provider: Mailpit locally, third-party at deploy — **confirmed** | ✅ |
| L072 | Local email: Mailpit (real SMTP), not console logging | ✅ |
| L036 | Own send-queue required (reminders cluster; provider daily cap) | ✅ |
| L112 | No card-for-discount at signup. Offer the discount at trial end | ✅ |
| L073 | ~~Payments developed locally — Stripe CLI~~ — **superseded, see below** | ❌ superseded |

## Privacy & workflow

| ID | Decision | Status |
|----|----------|--------|
| L064 | Data minimization baseline | 🔒 |
| L065 | Free tier disclosed in privacy policy — narrows the PRD's "private" claim | ✅ resolved, see `PRIVACY.md` |
| L015 | Allow-list scoping + version-pinned approval | ✅ |
| L016 | Ledger updated only on explicit approval | ✅ |
| L053 | PRD Phase 0 does not gate the build | ✅ |
| L105 | Settings screen — 7 sections, all mapping to existing tasks | ✅ |
| L108 | Support = email + form; diagnosis by query console, no admin UI | ✅ |

## Security — OWASP Top 10:2025

| ID | Decision | Status |
|----|----------|--------|
| L075 | OAuth `state` + PKCE required | ✅ |
| L076 | Fail closed everywhere (A10) | ✅ |
| L077 | Supply chain controls (A03) | ✅ |
| L078 | Security headers (A02) | ✅ |
| L079 | Signup must not leak account existence | ✅ |
| L080 | `security_events` table (A09) | ✅ |
| L081 | SSRF — `source_url` never fetched server-side | ✅ |
| L083 | Cookies: httpOnly + SameSite=Lax always; Secure/`__Host-` gated on `NODE_ENV` | ✅ |
| L122 | **Prompt injection (G12)** — structural delimiters + no tools/function-calling on the AI provider | ✅ |
| L123 | **Soft-delete query discipline (G13)** — every query filters `deleted_at IS NULL` | ✅ |
| L124 | **Trust-proxy: `TRUST_PROXY` env-gated, spoof-tested post-deploy** — the one control needing environment-specific code | ✅ |

## Tooling & workflow

| ID | Decision | Status |
|----|----------|--------|
| L084 | Execution moves to Claude Code | ✅ |
| L085 | Next.js *is* the Node app | ✅ |
| L086 | Document set consolidated | ✅ |
| L087 | MCP does not reduce token consumption | ✅ |
| L097 | `ai_usage` table now; admin panel deferred to F7 | ✅ |
| L098 | Skip → dashboard with AI features disabled, not blocked access | ✅ |
| L100 | Tone selector out of MVP — not in the PRD | ✅ |
| L109 | `Regenerate` decrements quota and shows the cost | ✅ |
| L111 | Trial generation cap: **40** (revised from the initially-proposed 60) | ✅ confirmed |

## Sizing — canonical, do not re-derive

| ID | Conclusion |
|----|-----------|
| L031 | ~200 KB DB growth per user per month |
| L032 | 1,000 users / 12 months → ~3.4 GB Postgres |
| L033 | 1,000 users → ~2.5 writes/min, ~9 reads/min (~0.05% of a small instance) |
| L034 | Compute isn't the constraint — Gemini's per-minute burst is |
| L035 | ~30 emails/user/month → provider free tier ≈ 300 users |
| L117 | **Gemini free tier verified: ~15 RPM / 1,500 RPD** — corrects an earlier overstatement, see record |

## Operations (P9) — confirmed in scope, fully specified

| ID | Task | Env |
|----|------|-----|
| T7.5 | Trust-proxy handling — own task, not folded into T2.4 | 🌐 deploy-only |
| T9.1 | `/api/health` — zero dependencies, never touches DB | 🌐 deploy-only |
| T9.2 | Nightly backup — in-container `pg_dump` → R2 | 🌐 deploy-only |
| T9.3 | Env validation at boot — fail fast on missing vars | ✅ local-complete |
| T9.4 | Expired-row sweep — `oauth_states`, `verification_tokens`, `auth_attempts` at 90 days | ✅ local-complete, **confirmed** |

## 🔴 Still open

| ID | Question | Blocks |
|----|----------|--------|
| L074 | Create LinkedIn company Page — required to create the app at all | T4.4 only |
| — | R2 window — 24h or 48h? PRD says "24–48 hours" | F4 scheduler |
| — | Does R2 fire if `interview_at` was never set? | F4 scheduler |
| — | **`contact_email` verification before use as Reply-To** — now genuinely required, since L038 confirmed the Pro send path | F4 send path |
| — | Pro send-path **design** — confirmation state, sent state, failure state (L038 is decided; the screens don't exist) | F4 send path |
| — | Subscription Expiry screen is empty — confirmed by full read; designer must build it | F6 downgrade handling |
| — | Payment Failed screen is draft copy with no retry action | F6-6 |
| — | Cancellation flow — referenced in checkout copy, never designed | F6 |
| — | F3 task decomposition — rules and schema exist, no task list | F3 |
| — | F5 — wireframe only, zero tasks | F5 |

**L038 is NOT open** — confirmed as both tiers (see the record below). What remains is design work the confirmed decision now requires, listed above as its own line.

## Superseded

| ID | Was | Now |
|----|-----|-----|
| L002 | Android MVP first | L020 — web first |
| L012 | React Native + Expo | L020 — React web |
| L007 | "Gemini free tier sufficient" (assumed) | L117 — verified, and L034 established the real constraint is per-minute burst |
| L021 | Nixpacks | L021a — Railpack |
| L048 | `pdf-parse` → Gemini | L061 — PDF straight to Gemini |
| L024 | Auth self-built (inferred) | L039 — confirmed |
| L046 | `experience_level` enum | L107 — years + months, no enum |
| L073 | Payments: Stripe-specific local dev notes | Superseded by Razorpay-only decision (§ below) |
| L093's 200/day proposal | Rejected before ever entering Part 1 | L093 as recorded — 20/hr·50/day·300/month |

---
---

# PART 2 — DECISION RECORDS

Only decisions with history worth keeping. Settled-on-first-pass items live in Part 1 alone. Records for L088–L112 are reproduced from the source files without alteration; new records (L113–L124) follow.

---

## Carried from `DECISIONS.md` (L001–L089) — unchanged

The following records exist in full in `DECISIONS.md` Part 2 and are not reproduced here to avoid duplication drift: **L017** (architecture), **L023/L039** (Supabase → self-built auth), **L021→L021a** (Railpack correction), **L047/L048→L061** (profile & résumé parsing), **L038/L054/L055** (follow-up delivery, original version — see L038 update below), **L057/L059/L065** (Gemini tier & privacy tension), **L067** (local-first development), **L068/L069/L070** (SSO), **L071** (OTP), **L072/L073** (local dev environment), **L088** (Postgres version), **L089** (backup placement).

**Read `DECISIONS.md` for these.** Nothing above has changed except where explicitly updated below (L038, L117).

---

## Carried from `DECISIONS-MOCKUP-REVIEW.md` (L090–L112) — unchanged

Full records for **L090–L112** exist in that file and are not reproduced here. Summary content is in Part 1 above. Read the source file for the four-part reasoning on: JD copy-on-write, async generation, atomic quota, fair-use ceiling arithmetic, queue depth, prompt snapshotting, retry policy, cost observability, skip behaviour, forgot-password design, tone selector, schema additions, structured output, source enum, trial cap, and no-card-at-signup.

---

## ⚠️ UPDATE — L038 — CONFIRMED: both tiers kept

**Original record** (`DECISIONS.md`): Option A (draft+copy) free, Option B (provider send) Pro.

**Evidence review** (this file, prior version): five sources — PRD ×3, designer's note, on-screen copy — all pointed toward copy-only. Flagged as open, recommendation was to drop the Pro send path.

**Your decision, explicit:** *"I told you already that i need to have both functionalities. For free tier users copy-only and send email manually. For pro users onclicking the followup button on the card component within the state component will send email automatically."*

**Status: ✅ CONFIRMED, not open.** The evidence imbalance is noted for the record but does not override an explicit business decision — showing real send capability has standalone value (demo, differentiation) that the PRD's MVP-scope language doesn't capture or rule out.

**Going with:**
- **Free:** draft + copy button. User sends manually from their own client.
- **Pro:** clicking the `Follow up` tag/button on the board card sends automatically via the configured provider, `Reply-To: contact_email`.

**What this reopens — the Pro send path now needs full specification, not just a decision:**

| | Status |
|---|---|
| Confirmation state before sending | ❌ not designed |
| Sent state (on the card, in the timeline) | ❌ not designed |
| Failure/bounce state | ❌ not designed |
| `contact_email` verification before use as Reply-To | 🔴 still open — see below |
| Sender domain reputation / deliverability plan | ❌ not addressed |
| Provider confirmation (Brevo capacity, L029) | ✅ confirmed separately |

**Could change if:** deliverability problems emerge in practice (the original concern — an unverified sending domain landing in spam, so the user believes a follow-up was sent when it wasn't) — revisit then with real data, not speculatively.

**Task impact:** F4's three previously-pending tasks (send endpoint, confirmation, sent/failure states) are **unblocked in principle but need design first** — marking as a distinct blocked state, not the same as "waiting on a decision."

---

## ⚠️ UPDATE — L117 — Gemini free tier limits, verified

1. **Initially stated:** I claimed free-tier quotas were cut 50–80% in December 2025 and might be as low as 250 requests/day.
2. **What changed:** verified against current 2026 sources. Gemini 2.5 Flash free tier: **~15 RPM, ~1,500 RPD, 1M TPM**, no credit card, no expiration. The trade-off is that Google may use free-tier prompts for training (already captured in L057/L065).
3. **Going with:** 1,500/day is comfortable at MVP scale. **The binding constraint is 15 requests per minute** — sixteen simultaneous generations and someone queues. This is why L091 put generation behind a job queue, and that reasoning holds regardless of the daily figure.
4. **Could change if:** your AI Studio console shows a different number — quota is per-project and is the only authoritative source.

**Corrects an overstated constraint.** Does not change any downstream decision — the job queue was already justified by the per-minute limit alone.

---

## L113 — Application deletion: soft, then immediate hard delete

1. **Initially stated:** Q12, raised early, never answered — hard or soft delete for applications.
2. **What changed:** resolved during the board/detail screen review. Deletion is available **only from the Rejected status**, via the overflow menu, with confirmation.
3. **Going with:** delete sets `applications.deleted_at` (soft). The application moves to a trash view. Emptying the trash **hard-deletes immediately** — no grace period.
4. **Could change if:** users report accidental permanent loss from the trash → add a grace period then, not preemptively.

**Schema:** `applications.deleted_at TIMESTAMPTZ`. Every board, list, search, and export query must filter `deleted_at IS NULL` — elevated to a named security gap (L123) because a resurfaced deleted record uses data against a stated user intent, not merely a display bug.

---

## L114 — Source field collection point

1. **Initially stated:** M03's filter and M05's chip both display `applications.source`, but M04's add-application form never collects it — found during the M05 screen-notes pass.
2. **What changed:** nothing to change — a genuine gap, closed by adding the field.
3. **Going with:** a Source dropdown in M04, **pre-filled by parsing `source_url`'s domain client-side**, user-correctable. No server-side fetch (consistent with L081's SSRF decision).
4. **Could change if:** domain parsing proves reliable enough to drop manual entry — unlikely, since referrals and direct applications have no useful domain.

---

## L115 — Card tag overflow

1. **Initially stated:** none — the mockup never draws more than 2 tags on any card, but the data model can produce 4 (age, `Follow up`, `Doc`, stage-specific).
2. **What changed:** measured the card's available width — 176px inner after padding. Two tags at the observed sizes (`Call log` ≈ 60px, `Tue 3pm` ≈ 54px, gap 5) fit at ~119px; three overflow at ~178px.
3. **Going with:** cap at **2 visible tags + a `+N` overflow indicator**. Priority order: `Follow up` (clickable, product-critical) first, then the most recent of the rest.
4. **Could change if:** the designer redraws the card with more width or a different tag treatment.

---

## L116 — Document persistence timing

1. **Initially stated:** M06 has both a Generate action and a "Save to application" button — ambiguous which one persists the `documents` row.
2. **What changed:** the quota is consumed at generation, not at the save click. If persistence waited for "Save to application," a user who generates, reads the result, and closes the tab would lose an artifact they already paid a generation for.
3. **Going with:** **persist on generation.** "Save to application" becomes an attach-and-return action, not the write itself.
4. **Could change if:** never, given the quota-consumption timing (L092) is fixed at enqueue.

---

## L118 — Session expiry: absolute, not sliding

1. **Initially stated:** open item in `FEATURE-A-SPEC.md` §10 — absolute vs sliding renewal, never decided.
2. **What changed:** sliding renewal keeps a stolen token alive indefinitely as long as it's used — an attacker who has it simply extends it by using it. Absolute expiry caps the damage window regardless of activity.
3. **Going with:** **24-hour absolute expiry.** `expires_at = now() + 24h` at issue, never extended. Rotate on login (session fixation defence, already in L044).
4. **Could change if:** user complaints about daily re-login are severe — SSO makes re-authentication one click, which mitigates this.

---

## L119 — Two follow-up reminder rules (R1 + R2)

1. **Initially stated:** the PRD's feature list (p.13) describes only one reminder — 7 days after application. No task ever captured a second rule.
2. **What changed:** re-reading the PRD's problem statement and workflow sections surfaced a second, distinct reminder: *"Organised applicants who follow up within 24–48 hours of an interview show significantly higher offer rates"* (p.8), and *"Interview confirmed → Interview prep reminder set"* (p.16). Different trigger, different clock, different message from the application follow-up.
3. **Going with:** two rules in one `reminders` table, distinguished by `reminder_type`:

   | | R1 — application | R2 — post-interview |
   |---|---|---|
   | Trigger | `date_applied` + 7 days | `interview_at` + 24 hours |
   | Status required | applied · assessment · interview | interview |
   | Message | "Following up on my application" | "Thank you for the conversation" |

   `interview_at` already exists (added for the board's `Tue 3pm` tag) — R2 needs no new column beyond the `reminders` table itself.
4. **Could change if:** the window is confirmed at 48h instead of 24h (still open), or R2 is deferred to v2 if it proves too complex to ship alongside R1.

**Schema:** `reminders` table — see `F4-TASKS.md` §1.

---

## L120 — Snoozing hides the derived follow-up tag; a failed send does not

1. **Initially stated:** the board's `Follow up` tag is derived from `applications` + `application_events` (never a stored flag, per the designer's note that it "survives a missed email"). Question: does a user-initiated snooze behave the same way as a system failure?
2. **What changed:** distinguished the two cases. A failed email is a **system** failure — the tag must persist so the user isn't let down silently. A snooze is a **user decision** — continuing to show the tag after the user explicitly deferred it is nagging, and a board full of tags the user already dismissed stops carrying signal.
3. **Going with:** `applications.follow_up_snoozed_until TIMESTAMPTZ`, checked in the derived-tag query alongside the existing conditions. **Deliberately on `applications`, not `reminders`** — keeps the tag computable without any F4 table existing, preserving the property that F2 alone can show follow-up state.
4. **Could change if:** never — the distinction between system failure and user decision is stable regardless of implementation details.

---

## L121 — 7-day follow-up window: fixed, not configurable

1. **Initially stated:** unclear whether the 7-day trigger should be a user-adjustable setting.
2. **What changed:** checked every source. PRD p.8, p.13, and p.16 all state 7 days. The designer's plate `iHpHi` note states it as fixed. The Settings screen (plate 09) has a toggle for "Follow-up reminders by email" but **no duration field** — the designer built the settings section and gave it on/off only, no interval control.
3. **Going with:** fixed at 7 days for MVP, stored as a named constant rather than a magic number scattered through the codebase — so making it configurable later is a column addition, not a code hunt.
4. **Could change if:** users request adjustability post-launch; the constant-not-magic-number choice makes that cheap.

---

## L122 — Prompt injection defence (G12)

1. **Initially stated:** not identified by either party — found by the designer in a wireframe note on the add-application plate: *"Pasted JD text is untrusted input. It goes into an LLM prompt, so it must be passed as data, never concatenated as instructions."*
2. **What changed:** neither `SECURITY.md` nor `SECURITY-CONTROLS.md` covered this. Every user-supplied field reaching a prompt — job descriptions, résumés, profile fields, call answers — is attacker-controllable.
3. **Going with:** structural separation (system instructions never contain user data; user data always delimited, never interpolated) plus output validation. **The strongest control: the AI provider is never given tools, function calling, or data access.** A successful injection can then only produce strange text, which the user reads before using — there is nothing to exfiltrate and nothing to trigger. Adding a tool later requires a security review, not a pull request.
4. **Could change if:** a future feature genuinely requires giving the model a capability — that decision must be made explicitly and reviewed, never added incidentally.

**Full spec:** `AI-RULES.md` §2.1, `SECURITY_quarterfinal.md` §13.

---

## L123 — Soft-delete query discipline (G13)

1. **Initially stated:** implicit in L113's soft-delete decision, not stated as a security requirement until the audit.
2. **What changed:** reframed from a correctness concern to an access-control one. A user who deleted an application has withdrawn it; surfacing it again — in a board, a list, a search result, an export, or an AI prompt — uses their data against a stated intent, which is an authorization failure, not merely a display bug.
3. **Going with:** every query touching `applications` filters `deleted_at IS NULL`. Enforced three ways: partial indexes make the correct path also the fast one, a single repository function is the only path to application data, and a named test (`SECURITY_quarterfinal.md` test #15) asserts a soft-deleted application never appears anywhere.
4. **Could change if:** never — this is a standing requirement on every future query touching `applications`.

---

## L124 — Trust-proxy: env-gated, spoof-tested

1. **Initially stated:** flagged during the security-controls pass as the one gap needing code that differs between local and production, then disputed as possibly premature alongside P9.
2. **What changed:** confirmed in scope, with full implementation notes written. Behind a hosting platform's proxy, every request appears to originate from the proxy's IP; if the rate limiter reads that directly, an attacker and every legitimate user become indistinguishable. The fix — reading `X-Forwarded-For` — is itself exploitable if trusted unconditionally, since a client can forge that header.
3. **Going with:** `TRUST_PROXY` env var gates the behaviour — `false` locally reads the raw socket address, `true` in production reads `X-Forwarded-For`'s first entry, only because the specific proxy is confirmed to overwrite client-supplied values rather than append to them. **Verification requires a post-deploy spoof test** — sending a forged header and confirming the logged IP is still the real one, not the forged one. This cannot be verified locally; there is no proxy on a laptop.
4. **Could change if:** never — this is inherent to any deployment behind a reverse proxy.

**Full spec:** `P9-IMPLEMENTATION.md` — T7.5.

---

## P9 — confirmed in scope (T9.1–T9.4)

1. **Initially stated:** created unasked when answering a yes/no completeness question; challenged; assessed as partly premature; left unresolved for roughly fifteen turns.
2. **What changed:** explicit instruction to keep the full group and write detailed implementation notes for each, regardless of build timing.
3. **Going with:** all four tasks remain, fully specified in `P9-IMPLEMENTATION.md`. T9.1 (health endpoint) and T9.2 (backup job) are marked 🌐 deploy-only — specified now, executed and verified at deployment. T9.3 (env validation) and T9.4 (expired-row sweep, retention confirmed at 90 days) are ✅ local-complete and can be built immediately.
4. **Could change if:** never on scope; only on when each is actually implemented, which was never in question — only their premature *creation* was disputed, not their eventual necessity.

---

## Update protocol

- **Part 1** is the scan layer — one line per decision, always current.
- **Part 2** carries history only where a decision moved. Records for L001–L112 live in their original source files and are referenced, not duplicated, to avoid drift between two copies of the same reasoning.
- Nothing enters as `Approved` without explicit confirmation. Items awaiting confirmation are marked, never assumed.
- Superseded entries are marked, never deleted.
- **This file is the one to cite going forward.** `DECISIONS.md` and `DECISIONS-MOCKUP-REVIEW.md` remain as historical record of how each decision was reached.

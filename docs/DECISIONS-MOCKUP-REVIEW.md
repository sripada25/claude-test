# DECISIONS-MOCKUP-REVIEW.md

Decisions from the mockup review, 2026-08-26. Continues `DECISIONS.md` numbering from L090.

Same four-part format: *initially stated · what changed · going with · could change if*.

Source: seven mockups (sidebar, sign-in, profile builder, pipeline board, add application, application detail, generate document).

---

## AT A GLANCE

| ID | Decision | Feature |
|----|----------|---------|
| L090 | JD stays editable; **copy-on-write** into `documents.jd_snapshot` | F2, F3 |
| L091 | Generation is **asynchronous** — save returns immediately, job queued | F3 |
| L092 | Quota decremented **atomically at enqueue**, refunded on failure | F3 |
| L093 | Pro fair-use: **20/hour · 50/day · 300/month** | F3, F6 |
| L094 | Queue depth cap: **2 free · 5 Pro**, rejected with a message | F3 |
| L095 | Profile **and** JD snapshotted onto the job at enqueue | F3 |
| L096 | **2 attempts**, split by error class — no retry on 400/safety/validation | F3 |
| L097 | **`ai_usage` table now**; admin panel deferred to F7 | F3, F7 |
| L098 | Skip → dashboard with **AI features disabled**, not blocked access | F1 |
| L099 | Forgot password = **OTP**, never a temporary password by email | F1 |
| L100 | **Tone selector out of MVP** — not in the PRD | F3 |
| L101 | `profiles.current_role` column added | F1 |
| L102 | `location_preference` becomes an enum: remote/hybrid/onsite | F1 |
| L103 | JD capped at **15,000 characters**, DB-enforced | F2 |
| L104 | Stage enum value `assessment`; UI may abbreviate to "Assess" | F2 |
| L105 | Settings screen — 7 sections, all mapping to existing tasks | F1 |
| L106 | Use Gemini **structured output mode** for extraction | F1, F3 |
| L107 | Experience = **years + months** (SMALLINT ×2). **Enum dropped** — never in PRD or mockups | F1 |
| L108 | Support = email + form; diagnosis by **query console**, no admin UI | F0, F7 |
| L109 | **`Regenerate` decrements quota** and shows the cost | F3 |
| L110 | `source` enum **and** `source_url`; scheme allow-list on URLs | F2 |
| L111 | Trial generation cap — **principle approved, number (60) NOT confirmed** | F1, F6 |
| L112 | **No card-for-discount at signup.** Offer the discount at trial *end* | F6 |

---

## DECISION RECORDS

### L090 — Job description editing

1. **Initially stated:** *"if he wants to change something later how will we provide users that provision… lets provide him a caution (is it finalized it cant be changed later)."*
2. **What changed:** the cost concern was misplaced — a 4 KB text field costs nothing to update. The real issue is **provenance**: a document claims "generated from this JD," and if the JD mutates, that claim silently becomes false. A caution modal forces a decision under pressure with incomplete information.
3. **Going with: copy-on-write.** The application's JD stays freely editable. `documents.jd_snapshot` is `NULL` by default, meaning "same as the application's current JD." On edit, copy the *old* value into `jd_snapshot` for documents that already used it, then update. Users who never edit pay zero extra bytes; those who do get correct provenance and no dialog.
4. **Could change if:** storage becomes material — it won't, at ~4 KB per edited application.

**Schema:** `documents.jd_snapshot TEXT NULL`

---

### L091 — Asynchronous generation

1. **Initially stated:** mockup 05 has *"Generate a cover letter after saving"* — timing unspecified.
2. **What changed:** blocking the save for ~5 seconds isn't just slow, it's a vulnerability — the request holds a database connection while waiting on an external API. Concurrent submissions exhaust the connection pool. A denial of service requiring no exploit. And a queue is needed regardless: L034 established that Gemini's per-minute burst limit forces simultaneous generations to queue.
3. **Going with:** `POST /api/applications` returns 201 immediately and enqueues a job. The detail screen shows a pending state. One `generation_jobs` table, in-process worker, **no Redis** (L030).
4. **Could change if:** never — synchronous generation doesn't survive concurrency.

**Schema:** `generation_jobs` — `id`, `application_id`, `user_id`, `type`, `status`, `attempts`, `error_class`, `prompt_inputs JSONB`, `created_at`, `completed_at`

---

### L092 — Atomic quota decrement

1. **Initially stated:** *"what are you going to do handle it?"* — on preventing free-tier queue abuse.
2. **What changed:** checking quota then decrementing separately is a race. Fifty rapid clicks enqueue fifty jobs before the first decrement lands.
3. **Going with:** one statement, at enqueue:
   ```sql
   UPDATE generation_quota SET used = used + 1
   WHERE user_id = $1 AND period_start = date_trunc('month', now())
     AND used < 5
   RETURNING used;
   ```
   No row returned ⇒ refuse to enqueue. Compensating `used = used - 1` on job failure.
4. **Could change if:** quota rules change; the atomic pattern stays.

---

### L093 — Pro fair-use ceiling

1. **Initially stated:** I proposed **20/hour, 200/day**. You asked: *"how much does that cost?"*
2. **What changed — I hadn't done the arithmetic.** Pro is ₹349/month ≈ **$4**. At $0.002/generation (L058):

   | Limit | Generations/month | Cost | Verdict |
   |---|---|---|---|
   | 200/day | 6,000 | **$12** | **Loses $8/user/month** |
   | 300/month | 300 | $0.60 | 15% of revenue |

   **My proposal was three times your revenue.** Every heavy Pro user would have been unprofitable.
3. **Going with: 20/hour · 50/day · 300/month.** Genuine heavy use is ~90/month (30 applications × 2 documents + follow-ups), so this is 3.3× headroom. Costs $0.60 against $4 revenue. The daily cap absorbs bursts. **Must be stated in the terms** — "unlimited" with a fair-use ceiling requires disclosure.
4. **Could change if:** real usage data shows the ceiling binding on genuine users → raise it, watching the margin.

**Your question caught a costing error that would have made Pro loss-making.**

---

### L094 — Queue depth cap

1. **Initially stated:** *"Max 2 jobs per user (free). Max 5 jobs per user (paid for pro)."*
2. **What changed:** your numbers were right. Free users only have 5/month total, so depth barely matters — but it stops the UI queuing an entire monthly allowance in one panicked minute. Pro is where it does work.
3. **Going with:** 2 free / 5 Pro pending jobs. **Reject at enqueue with a visible message** — *"2 documents already generating"* — never a silent drop.
4. **Could change if:** users hit it legitimately.

---

### L095 — Snapshot inputs at enqueue

1. **Initially stated:** you asked *"why profile fetching here"* — because the job runs later and needs the profile as prompt input.
2. **What changed:** the question exposed a better design. Fetching at execution means a database round-trip *and* a surprise if the user edits their profile between clicking and the job running.
3. **Going with:** resolve profile + JD at enqueue, store on `generation_jobs.prompt_inputs`. Same provenance reasoning as L090.
4. **Could change if:** payload size becomes a problem — it won't, at ~6 KB.

---

### L096 — Retry policy

1. **Initially stated:** *"lets make 2 attempts then permanent failure. Add that to the logs."*
2. **What changed:** a flat retry count wastes money on deterministic failures. A "malformed job" — empty JD, prompt-breaking characters, a safety-filter trip — fails identically every attempt.
3. **Going with: 2 attempts, split by error class.**

   | Error | Retry? |
   |---|---|
   | Timeout, 429, 5xx | ✅ transient |
   | 400, safety block, validation failure | ❌ **guaranteed waste** |

   Every attempt logged to `ai_usage` with `error_class`. Permanent failure surfaces a retry button.
4. **Could change if:** an error class is misclassified in practice.

---

### L097 — Cost observability

1. **Initially stated:** *"Cost controller Admin panel… we can have a look on ai costs, ai failure rates etc."*
2. **What changed:** the valuable half is cheap and the expensive half is deferrable. Capturing usage data is irreversible — **you cannot reconstruct last month's spend after the fact.** An admin UI is a large new attack surface (admin auth, privilege escalation, a second authorization model) for something two SQL queries answer today.
3. **Going with:** **`ai_usage` table from day one.** Every AI call writes one row: `user_id`, `job_id`, `provider`, `model`, `operation`, `tokens_in`, `tokens_out`, `cost_estimate`, `latency_ms`, `status`, `error_class`, `created_at`. **Panel deferred to F7 (Operations)**, outside F1–F6.
4. **Could change if:** support volume justifies the UI sooner.

**Two rules binding on the eventual panel:**
- **Aggregates only** — cost, counts, failure rates, latency percentiles
- **Never prompt contents or generated documents.** That would violate L064 and undo the privacy position. A support engineer needs `error_class` and timestamps, not the resume.

---

### L098 — Skip behaviour

1. **Initially stated:** L047 made the profile mandatory before app access. Mockup 02 shows *"Skip for now"*.
2. **What changed:** your resolution — *"if skip for now is clicked we will take user to the dashboard but all the ai related functionalities, generations, related ui components will be in disabled state."* Cleaner than gating app access, and it matches the pattern L040 already uses for email verification: let people in, gate the expensive thing.
3. **Going with:** ship mandatory (skip button **built and hidden**). If relaxed later, skip → dashboard with all AI actions disabled and a prompt to complete the profile. Tracking works without a profile; generation doesn't.
4. **Could change if:** signup drop-off is high → unhide the button. A CSS change, not a rebuild.

---

### L099 — Forgot password

1. **Initially stated:** *"our backend should send a temporary password to the email entered by user if verified."*
2. **What changed:** a temporary password travels in plaintext through mail servers and sits in an inbox indefinitely — anyone with later access to that inbox has a working credential. It also contradicts L071's rejection of long-lived secrets. Separately, *"if verified"* would leak account existence (gap G6).
3. **Going with:** enter email → **always the same response** (*"if that address has an account, we've sent a code"*) → OTP if it exists → user sets their own password. **No password ever travels by email.** Reuses `verification_tokens` with `purpose = 'password_reset'`, already in the schema.
4. **Could change if:** nothing. Emailing credentials has no safe variant.

---

### L100 — Tone selector

1. **Initially stated:** mockup 07 shows *"Tone: Standard"*. You asked whether it was in the PRD.
2. **What changed:** checked — **it isn't.** The PRD's AI generation section lists cover letter, resume, PDF download, the 5/month counter, and document storage. No tone control. A designer addition.
3. **Going with:** **out of MVP.** It multiplies prompt templates and testing surface for unclear value, and every option is another way to produce a bad letter. The control stays in the mockup as a v2 marker.
4. **Could change if:** users ask for it post-launch.

---

### L101–L104 — Schema changes from the mockups

| ID | Change | Source |
|----|--------|--------|
| L101 | `profiles.current_role TEXT` — distinct from `target_role`, wasn't in the schema | Mockup 02 |
| L102 | `location_preference` → enum `('remote','hybrid','onsite')`; schema had free `TEXT` | Mockup 02 |
| L103 | `applications.job_description` capped at 15,000 characters, DB-enforced | Mockup 05: `3,214 / 15,000` |
| L104 | Stage enum value `assessment` (PRD p.13); UI may render "Assess" | Mockup 04 vs PRD |

L104 note: *"since its enum we can change if my colleague insists."* The enum value and the display label are independent — changing the label costs nothing, changing the value is a migration.

---

### L105 — Settings screen

Seven sections, each mapping to an existing backend task — no new backend work:

| Section | Task |
|---|---|
| Profile | T5.5 |
| Connected accounts — with last-credential guard | T4.5 |
| Email + password change | T3.6, T3.7 |
| Active sessions / log out everywhere | T3.9 |
| Subscription — plan, trial days remaining | T6.1 |
| Timezone | T5.5 |
| Delete account | T3.8 |

---

### L106 — Structured output for extraction

1. **Initially stated:** *"can you explain which planning can get atleast 5 9's after 9 (99.99999) success."*
2. **What changed — honest answer: seven nines is not achievable.** That's ~3 seconds of failure per year, and you depend on an external API whose own availability is around 99.9%. Nobody offers it, including Google. Parsing failures are partly model behaviour, not only our bug — Gemini can return prose, truncate, or wrap JSON in markdown fences.
3. **Going with:**
   - **Gemini structured output mode** (`responseSchema`) — constrains generation to the schema rather than hoping
   - Strip markdown fences before parsing
   - Validate against a schema; treat failure as a job failure, not a crash
   - **Cover letters request plain text, not JSON** — nothing to parse
   - **The queue is what delivers near-100% *perceived* reliability**: retries happen behind a "generating" state, so a transient failure becomes a delay the user never sees
4. **Could change if:** measured failure rates in `ai_usage` (L097) show a specific error class dominating.

**The realistic target is absorbing failures, not eliminating them.**

---

### L110 — Source: enum **and** URL

1. **Initially stated:** *"lets go with both (source, source_url). if source is added, we will filter. if no source added filter wont work and we ask user to either add the source."*
2. **What changed:** mockup 04's `Source ⌄` filter needs a **categorical** value; the schema only had `source_url`, which is a URL and can't be grouped. You also asked about URL risks — there are three real ones.
3. **Going with:**
   - `source` enum — `linkedin, naukri, indeed, referral, company_site, other`, optional
   - `source_url TEXT`, optional
   - **Dropdown pre-fills by parsing the URL's domain client-side** — no server fetch, no cost, user can correct it

   | Risk | Control |
   |---|---|
   | **SSRF** | Never fetch `source_url` server-side (L081) — this is why that decision matters |
   | **Stored XSS** — `javascript:alert(1)` as an href | **Scheme allow-list: `http`/`https` only.** Reject `javascript:`, `data:`, `file:`, `vbscript:` at input |
   | **Reverse tabnabbing** — linked page rewrites your tab via `window.opener` | `rel="noopener noreferrer"` on every outbound link |
4. **Could change if:** domain parsing proves accurate enough to drop the manual dropdown — unlikely, since referrals and direct applications have no useful domain.

---

### L111 — Trial generation cap ⚠️ **NUMBER NOT CONFIRMED**

1. **Initially stated:** PRD p.13 — *"12-day free trial — full Pro access, no credit card required."* I flagged that unlimited plus no card means throwaway emails are unbounded cost.
2. **What changed:** you agreed to the principle — *"agreed to ur advice on not going with unlimited promise… but shows user the full potential of using trackr"* — and asked me to suggest a plan. I proposed **60 generations** and modelled it:

   | | Realistic | Worst case |
   |---|---|---|
   | Unlimited (bounded only by L093) | $28 | **$300** |
   | 60-generation cap | $28 | **$60** |

   Same expected cost; worst case cut 5×. 60 is **12× the free tier** and more than double what a realistic trial user consumes (~28), so it is invisible to genuine users.
3. **Going with:** ⚠️ **principle approved, number pending.** The cap applies to **generation only** — tracking, PDF download, follow-up sending and every other Pro feature stay genuinely unlimited during trial. A crippled trial demonstrates nothing.
4. **Could change if:** real `ai_usage` data shows the cap binding on genuine trial users → raise it.

**You approved limits. You have not approved 60.** I wrote it into `COST-MODEL.md` §3 as settled — that was premature.

---

### L112 — No credit card at signup

1. **Initially stated:** *"add your credit card and get instant discount on your first pro plan purchase can work so i wondering to add only on your confirmation about this idea."*
2. **What changed:** the mechanism has three costs. It pulls F6 into F1's trial flow, creating a dependency the build order deliberately avoids. Collecting a card still requires PCI-compliant hosted checkout even when nothing is charged. And it reintroduces exactly the friction the no-card trial exists to remove — card-required trials convert at 40–60% but produce far fewer trials.
3. **Going with:** **no card at signup.** Offer the discount **at trial end**, to users who actually used the product — same incentive, no upfront friction, and pitched to a warm user rather than a stranger.
4. **Could change if:** trial-to-paid conversion is very low *and* abuse is high — the card is the standard remedy for both. Revisit with real numbers, not before.

**Expect the conversion rate to look bad regardless.** No-card trials run 8–15% against card-required 40–60%. Judge absolute paying users, not the percentage — you're trading rate for volume and usage data, which is correct pre-revenue.

---

## Corrections logged this session

| | What |
|---|---|
| L093 | My 200/day Pro ceiling would have cost $12/user against $4 revenue. Caught by your question. |
| L099 | Temporary-password-by-email would have shipped a credential-in-inbox weakness. |
| L107 | I proposed dropping months from experience. You were right to keep it — see below. |
| L111 | I wrote "cap the trial at 60" into `COST-MODEL.md` §3 as a settled decision. You had approved *limits*, not that number. Now marked pending. |
| — | L110–L112 appeared in the at-a-glance table with no decision records behind them — I appended table rows via a script and never wrote the records. You caught the inconsistency. Records now written. |
| — | I re-presented *"the profile is not account metadata"* as a fresh insight. It's your own L047 rationale, already written in `FEATURE-A-SPEC.md` §1. You caught it. |
| — | My throwaway-email figure of 12,000 generations was double the truth. L093's 300/month cap binds before the 50/day one over a 12-day window: 20 accounts × 300 = **6,000 generations, $12**. |

---

### L107 — Experience: years **and** months, no enum

1. **Initially stated:** L046 set an enum — junior/mid/senior/lead. Mockup 02 shows `3–5 years`. You proposed years + months dropdowns.
2. **What changed — twice:**
   - **Verified the enum was never grounded.** PRD p.11 and p.13 both say only *"experience level"*. Mockup 02 shows year ranges. **I invented junior/mid/senior/lead in L046**; nothing in the PRD or the mockups supports it. You approved my proposal, not a requirement.
   - **I then argued against months** — staleness, and Gemini treating "5 years" and "4 years 7 months" identically. **You overrode it with better reasoning:** Indian HR and ATS systems ask for years and months, LinkedIn does the same, and the user should be able to state their experience as accurately as they wish. What the model needs is not the constraint; what the user expects to provide is.
3. **Going with:**
   ```sql
   years_experience  SMALLINT NOT NULL CHECK (years_experience  BETWEEN 0 AND 60),
   months_experience SMALLINT NOT NULL DEFAULT 0
                              CHECK (months_experience BETWEEN 0 AND 11)
   ```
   Two dropdowns. **No enum, no `other` option, no `ALTER TYPE ... ADD VALUE`, so no schema-modification grant on the application database user** — which was the real risk in the extensible-enum design, larger than injection.
   The enum task is **commented out, not deleted**, referencing this record.
4. **Could change if:** prompt quality measurably suffers from raw numbers → derive a band *from* the numbers for prompt use only. The stored values stay as the user entered them.

---

### L108 — Support: minimal channel, queries not UI

1. **Initially stated:** *"where can i see or a developer can see the ai_usage, error_class timestamps to diagnose."* — after I skipped support in the L097 deferral.
2. **What changed:** I had folded support into the admin-panel deferral, which was wrong. A paying user with a failed generation needs a channel regardless of whether an admin UI exists.
3. **Going with:** support email + a contact form on the marketing site (2 tasks, F0). Diagnosis via **Railway's built-in query console** — no `DATABASE_URL` distributed to any laptop, which keeps L064 intact. Runbook queries in `SUPPORT.md`. **Never query document or JD content for diagnosis** — `error_class` and timestamps are sufficient.
4. **Could change if:** support volume, or a non-technical person needing access, justifies F7's panel.

---

### L109 — Regenerate decrements quota

1. **Initially stated:** mockup 07 has a `Regenerate` button; nothing said whether it costs a generation.
2. **What changed:** each click is a full-price Gemini call. Unmetered, it's an uncapped cost line hiding in plain sight — and the most likely cause of real usage exceeding the 2-documents-per-application model in `COST-MODEL.md`.
3. **Going with:** `Regenerate` decrements quota atomically (L092), same as any generation. The button must **show the cost** — *"Regenerate (uses 1 of 3 left)"*. Watch its share of `ai_usage` after launch.
4. **Could change if:** regeneration rates suggest the first output is routinely poor — that's a prompt problem, not a quota problem.

# PRIVACY.md — Trackr

Two parts: a **draft user-facing privacy policy** (§A) and an **internal data-handling reference** (§B) that maps every claim to where it's enforced in code.

> ## ⚠️ NOT LEGAL ADVICE
>
> This is a technically accurate draft written from the system's actual data flows. **It is not a lawyer's work and must be reviewed before publication.**
>
> India's DPDP Act 2023 carries penalties up to ₹250 crore for significant breaches. A review costs a fraction of your hosting bill for the year. Do it before the first real user.
>
> Where a decision is legal rather than technical, it's marked **[LEGAL]**.

---
---

# PART A — DRAFT PRIVACY POLICY

**Last updated:** [DATE] · **Effective:** [DATE]

## 1 · Who we are

Trackr is a job application tracker. [LEGAL — entity name, registered address, and whether you're a registered company or sole proprietor. This determines your obligations.]

**Contact for privacy questions:** [privacy@yourdomain]
**Grievance Officer:** [LEGAL — DPDP requires a named contact for grievances]

## 2 · What we collect

### You give us directly

| | Why |
|---|---|
| Email address | Your account identity and how we contact you |
| Password | Stored only as an Argon2id hash — we cannot read it |
| Name, current role, target role, experience, skills, salary expectation, location preference | Used to tailor the documents we generate for you |
| Contact email (if different from your login) | Appears on generated documents and as the reply address on follow-ups |
| Résumé, if you upload one | Read once to fill your profile, then **discarded** — see §4 |
| Job applications — company, role, job description, dates, notes, source links | The core of the product |
| Call notes | If you choose to log them |
| Timezone | So reminders arrive at a sensible hour |

### Collected automatically

| | Why |
|---|---|
| Session identifier | To keep you signed in |
| Login attempt records — IP, timestamp, success | To detect brute-force attacks |
| Security events — failed logins, email changes, account linking | To investigate suspicious activity |
| Usage counts — how many documents you generated | To enforce plan limits |

**We do not use analytics, advertising, or third-party tracking cookies.** The only cookies we set are your session and your interface preferences.

### If you sign in with Google

We receive your **name and email address only**. We do not request or receive your photo, contacts, calendar, or any other Google data.

## 3 · 🔴 AI processing — read this section

**To generate cover letters and résumés, and to read an uploaded résumé, we send your data to Google's Gemini API.**

**What is sent:** your profile (name, roles, experience, skills, location) · the job description you pasted · your uploaded résumé, if you upload one.

**What is not sent:** your password · your email address · your other applications · your notes · your call logs · your payment details.

### ⚠️ Google may use this content to improve their models

We currently use Google's free Gemini tier. **Under Google's terms, content submitted through the free tier may be used to improve their models.** We're telling you this plainly because you deserve to know before you paste a job description or upload a résumé.

**What this means in practice:** the profile and job description used to generate a document may be retained and reviewed by Google, and may contribute to training their AI models. This does not apply to any of your data that never reaches generation.

**You control this.** Documents are only generated when you ask. **If you never use generation, none of your data is ever sent to any AI provider** — you can use Trackr purely as a tracker with no AI processing at all.

We intend to move to Google's paid tier, which does not permit training on submitted content. **We will update this page and email you before that changes.**

⚠️ **[LEGAL — this section must be reviewed. It is the highest-risk disclosure in this policy, and it sits alongside a product commitment that "user data is private." Those two statements need reconciling in writing before publication.]**

## 4 · Your résumé file

When you upload a résumé, we read it once to fill in your profile, then **the file is discarded**. We keep the structured fields you review and confirm — not the document.

We never store your résumé file on disk or in cloud storage.

## 5 · Who else touches your data

| | What they see | Where |
|---|---|---|
| **Railway** | Hosts the application and database | [LEGAL — confirm region] |
| **Google (Gemini)** | Profile and job descriptions during generation — §3 | — |
| **Brevo** | Your email address and the content of emails we send you | EU |
| **Cloudflare R2** | Documents you explicitly save as PDFs | — |
| **Razorpay** | Payment details, if you subscribe | India |

**We never give your payment card details to anyone, because we never have them** — Razorpay collects them directly on their own hosted page.

**We do not sell your data. We do not share your job search with recruiters, employers, or anyone else.** [LEGAL — this mirrors the product commitment; keep it only if it stays true.]

## 6 · How long we keep things

| | Retention |
|---|---|
| Account and applications | Until you delete them |
| Session records | 30 days, or until you sign out |
| Verification codes | 10 minutes |
| Login attempt records | [LEGAL — 90 days suggested] |
| Security events | [LEGAL — 90 days suggested] |
| Call transcripts | [LEGAL — you set this in Settings; default undecided] |
| Data after account deletion | Removed immediately — see §7 |

## 7 · Your rights

Under India's DPDP Act 2023 you can:

- **See your data** — Settings → Data & privacy → Export all my data
- **Correct it** — edit anything in Settings or on any application
- **Delete it** — Settings → Data & privacy → Delete my account. This removes your profile, applications, documents, call logs, and reminders. It cannot be undone.
- **Withdraw consent** — stop using generation, or delete your account
- **Complain** — contact our Grievance Officer at [EMAIL], or the Data Protection Board of India

**We respond within [LEGAL — 30 days suggested].**

## 8 · Security

Passwords are hashed with Argon2id. Sessions are stored server-side and can be revoked. All traffic uses HTTPS. Session tokens are stored hashed, so a database breach would not expose live sessions.

**No system is perfectly secure.** If a breach affects your data, we will notify you and the Data Protection Board as the law requires.

## 9 · Children

Trackr is not intended for anyone under 18. We do not knowingly collect data from children. [LEGAL — DPDP has specific requirements for children's data; confirm your age-gating obligation.]

## 10 · Changes

We'll update this page and change the date above. For material changes — particularly anything affecting §3 — we'll email you before it takes effect.

---
---

# PART B — INTERNAL REFERENCE

Every claim in Part A, mapped to where it's enforced. **If code and policy diverge, the policy becomes a false statement — which is the actual legal risk.**

## B1 · Claim → enforcement

| Policy claim | Enforced by | Ledger |
|---|---|---|
| "We cannot read your password" | Argon2id, never reversible, never logged | T2.1, L039 |
| "Résumé file is discarded" | Buffer held in memory, never written to disk or R2 | L064, `SECURITY.md` G10 |
| "We never have your card details" | Razorpay hosted checkout | L064 |
| "Sessions can be revoked" | Server-side `sessions.revoked_at` | L044 |
| "Session tokens stored hashed" | `sessions.token_hash` = SHA-256 | `DATABASE.md` §2.3 |
| "Deletion removes everything" | `ON DELETE CASCADE` from `users` | `DATABASE.md` §4 |
| "We don't send your other applications to AI" | Only the single JD + profile enter the prompt | `AI-RULES.md` §4 |
| "No analytics or tracking" | No third-party scripts | — |
| "Only session and preference cookies" | `SECURITY-CONTROLS.md` §11 | L083 |

## B2 · 🔴 RESOLVED — free tier, with disclosure (L059, L065)

**Decision: free Gemini tier, disclosed in Part A §3.**

That's a legitimate position and the honest one — the alternative was staying quiet about it. What it costs you is a contradiction that now has to be reconciled in copy, not in code.

**The PRD's commitment** (p.21): *"Telemetry on application content — User data is private. No selling of job search data to recruiters or employers."*

**Both can be true if worded precisely**, and the distinction is real:

| | Status |
|---|---|
| "We don't sell your data to recruiters or employers" | ✅ still true |
| "We don't run analytics on your applications" | ✅ still true |
| "Your data is private" — unqualified | ❌ **now misleading.** Generation content reaches Google |

⚠️ **The PRD sentence needs narrowing** to something like *"We never share your job search with recruiters or employers, and we never sell your data. Generating a document sends that job description and your profile to our AI provider — see the privacy policy."*

**Marketing copy must not overstate this.** A landing page claiming "your data stays private" while §3 says otherwise is the exact mismatch regulators look for.

**Trigger for revisiting:** move to the paid tier and §3 changes materially — which requires emailing users before it takes effect, per §10. Cheaper to do it before you have many.

## B3 · Not built yet — Part A promises them

| Promise | Task | Status |
|---|---|---|
| "Export all my data" | **NEW — for the quarterfinal task list** | 🔴 Plate 09 shows the control; nothing implements it. Distinct from `SUPPORT.md`, which is internal diagnostics |
| "Delete my account" | T3.8 | ⬜ |
| Grievance Officer contact | **NEW — for the quarterfinal task list** | 🔴 [LEGAL] · closed after real-hosting testing |
| Call transcript retention setting | **no task** | 🔴 Plate 09 shows it, value undecided |
| Terms + Privacy pages | F0-1.8 | ⬜ |

⚠️ **A privacy policy promising export while export doesn't exist is a false statement.** Either build it before publishing, or remove the claim.

## B4 · Data classification

| Class | Fields | Rules |
|---|---|---|
| **Secret** | `password_hash`, `token_hash`, API keys | Never in a response, log, or error |
| **Sensitive personal** | Résumé content, salary, contact email, call notes | Never logged · never in support queries (`SUPPORT.md` §4) · encrypted at rest |
| **Personal** | Name, email, roles, skills | Standard handling |
| **Operational** | Counts, timestamps, error classes | Safe to query and aggregate |

**Support diagnosis uses only the Operational class.** `SUPPORT.md` §4 lists what must never be read.

## B5 · Consent

| | Mechanism |
|---|---|
| Account creation | Checkbox on signup linking Terms + Privacy — **not pre-ticked** |
| AI processing | Implied by choosing to generate. ⚠️ **[LEGAL] — DPDP may require explicit consent given §3's disclosure** |
| Marketing email | Separate opt-in, off by default |
| Follow-up reminders | Part of the service; opt-out in Settings |

⚠️ **A pre-ticked consent box is not consent under DPDP.**

## B6 · Breach response — [LEGAL]

Undefined. Needed before launch:

1. Detect — `security_events` gives the signal (L080), nothing alerts on it yet
2. Contain
3. Assess scope
4. Notify the Data Protection Board — **[LEGAL] confirm the deadline**
5. Notify affected users
6. Document

**The one thing to do now:** make sure `security_events` captures enough to reconstruct an incident. It does (L080) — but nothing alerts, so nobody would know. That's `SECURITY-CONTROLS.md` §8's production requirement.

---

# WHAT TO DO NEXT

| | Action |
|---|---|
| ✅ | ~~Decide the Gemini tier~~ — **free tier, disclosed in §3** (L059) |
| 🔴 | **Have this reviewed by a lawyer** familiar with DPDP |
| 🔴 | **Build data export** — Part A promises it, nothing implements it. New task |
| 🔴 | **Narrow the PRD's "user data is private" claim** — see B2. Marketing copy must match §3 |
| 🟠 | Name a Grievance Officer — new task, closed after real-hosting testing |
| 🟠 | Set retention periods — every `[LEGAL]` in §6 |
| 🟠 | Confirm Railway's hosting region |
| 🟡 | Add the signup consent checkbox — unticked |

**The document is technically accurate today. Every gap above is a decision, not a discovery.**

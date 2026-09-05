# F4-TASKS.md — Follow-up system

Complete task specification. **Two reminder rules**, not one — the post-interview follow-up is added to MVP.

Self-contained. Screen map in `F4-SCREEN-MAP.md`.

---

# 0 · THE SECOND RULE

The PRD states a post-interview follow-up in two places, and no feature list or task ever captured it:

> p.8: *"Organised applicants who follow up **within 24–48 hours of an interview** show significantly higher offer rates."*
> p.16: *"Interview confirmed → **Interview prep reminder set**"*

Different trigger, different clock, different message from the 7-day application follow-up.

| | R1 — Application | R2 — Post-interview |
|---|---|---|
| **Trigger** | `date_applied` + 7 days | `interview_at` + 24 hours |
| **Applies when status is** | applied · assessment · interview | interview |
| **Message** | "Following up on my application" | "Thank you for the conversation" |
| **Source** | PRD p.8, p.13, p.16 | PRD p.8 |
| **Cancelled by** | a `follow_up_sent` event | a `follow_up_sent` event after `interview_at` |

⚠️ **`interview_at` already exists** — added to `applications` for M03's `Tue 3pm` tag. R2 needs no new column.

---

# 1 · DATABASE

## F4-1.1 · `reminders` table ✅

```sql
CREATE TYPE reminder_type   AS ENUM ('application_followup','post_interview');
CREATE TYPE reminder_status AS ENUM ('pending','snoozed','sent','dismissed');

CREATE TABLE reminders (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id        UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  application_id UUID NOT NULL REFERENCES applications(id) ON DELETE CASCADE,
  type           reminder_type   NOT NULL,
  status         reminder_status NOT NULL DEFAULT 'pending',
  due_at         TIMESTAMPTZ NOT NULL,        -- computed in the user's timezone
  snoozed_until  TIMESTAMPTZ,
  draft_content  TEXT,                        -- generated once, then editable
  sent_at        TIMESTAMPTZ,                 -- user-confirmed, not system-sent
  dismissed_at   TIMESTAMPTZ,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT now(),

  UNIQUE (application_id, type)               -- one of each per application
);

CREATE INDEX idx_reminders_queue ON reminders (user_id, due_at)
  WHERE status IN ('pending','snoozed');
```

⚠️ **`UNIQUE (application_id, type)`** prevents a scheduler bug producing duplicate reminders for one application.
⚠️ **`sent_at` means "the user told us they sent it"** — Trackr does not send. See §5.

**Deletion:** cascades from both `users` and `applications`. Add to the graph in `DATABASE_quarterfinal.md` §6.

**Env:** ✅ local-complete

## F4-1.2 · Snooze column on `applications` ✅

```sql
ALTER TABLE applications
  ADD COLUMN follow_up_snoozed_until TIMESTAMPTZ;
```

⚠️ **Deliberately on `applications`, not `reminders`.** The board's `Follow up` tag is derived from `applications` alone (§3) — putting the snooze state on `reminders` would make the board depend on F4, breaking the property that the tag works before F4 exists.

**Env:** ✅ local-complete

---

# 2 · THE DERIVED TAG — updated for both rules

Supersedes the single-rule version in `F4-SCREEN-MAP.md` §3.

```sql
-- shows the Follow up tag when EITHER rule fires and no snooze is active
(
  -- R1: applied 7+ days ago, no follow-up recorded
  ( status IN ('applied','assessment','interview')
    AND date_applied < now() - interval '7 days'
    AND NOT EXISTS (SELECT 1 FROM application_events e
                    WHERE e.application_id = a.id AND e.type = 'follow_up_sent') )
  OR
  -- R2: interview happened 24h+ ago, no follow-up since
  ( status = 'interview'
    AND interview_at IS NOT NULL
    AND interview_at < now() - interval '24 hours'
    AND NOT EXISTS (SELECT 1 FROM application_events e
                    WHERE e.application_id = a.id
                      AND e.type = 'follow_up_sent'
                      AND e.created_at > a.interview_at) )
)
AND (follow_up_snoozed_until IS NULL OR follow_up_snoozed_until < now())
AND deleted_at IS NULL
```

**Still derived from `applications` + `application_events` only.** No `reminders` dependency.

⚠️ **R2's `NOT EXISTS` is time-scoped** — a follow-up sent *before* the interview doesn't cancel the post-interview one.

**Snooze hides the tag.** The designer's note says the flag *"survives a missed email"* — that's system failure. A snooze is a user decision, and continuing to show it is nagging.

**References:** F2-3.4 · M03-09

---

# 3 · SCHEDULER

## F4-2.1 · Reminder scheduler ⚙️

Runs in the app container — **no separate service** (L030, L089).

**Two rules, one job:**

```
Every hour:
  R1  INSERT reminders (type='application_followup')
      for applications where date_applied = today - 7 days
        AND status IN (applied, assessment, interview)
        AND deleted_at IS NULL
      ON CONFLICT (application_id, type) DO NOTHING

  R2  INSERT reminders (type='post_interview')
      for applications where interview_at = now() - 24 hours (within the hour window)
        AND status = 'interview'
        AND deleted_at IS NULL
      ON CONFLICT (application_id, type) DO NOTHING
```

⚠️ **`due_at` is computed in the user's timezone** (L041) — 9am local, not 9am UTC. Without this every Indian user gets reminders at 2:30pm.
⚠️ **`ON CONFLICT DO NOTHING`** makes the job idempotent. A double run creates nothing.
⚠️ **Filter `deleted_at IS NULL`** — a deleted application must never generate a reminder.

**Env:** ⚙️ same code both environments; only the email transport differs at notification time.
**References:** L036 · L041 · L089

## F4-2.2 · Notification send ⚙️

**Distinct from the follow-up email itself.** This notifies *your user* that a follow-up is due — it does not email a recruiter.

⚠️ **Reminders cluster.** Everyone's 7-day mark lands in the same morning batch (L036). The send queue must spread the batch, or a single morning exceeds the provider's daily cap and legitimate verification emails start failing.

**Respects** the Settings toggle: "Follow-up reminders by email" (plate 09).

**Env:** ⚙️ Mailpit locally → provider at deploy. `EMAIL_TRANSPORT` only.

---

# 4 · API

| ID | Endpoint | Notes | Env |
|---|---|---|---|
| **F4-2.3** | `GET /api/reminders` | Queue — `Due now` (due_at ≤ now) and `Upcoming`. ⚠️ filter `deleted_at IS NULL` on the joined application | ✅ |
| **F4-2.4** | `POST /api/reminders/:id/draft` | Generates via `AIProvider.draftFollowUp()`. ⚠️ **does not consume quota** (L055) | ✅ |
| **F4-2.5** | `PATCH /api/reminders/:id` | `{ action: 'snooze', until }` or `{ action: 'dismiss' }`. Snooze also writes `applications.follow_up_snoozed_until` | ✅ |
| **F4-2.6** | `POST /api/reminders/:id/sent` | User confirms they sent it. Writes `sent_at` **and** an `application_events` row with `type='follow_up_sent'` — the row §2 checks for | ✅ |

⚠️ **F4-2.6 writes both.** One action, two consequences: the reminder closes and the board tag clears.
🔧 **`user_id` from the session on every one.**

---

# 5 · SENDING — copy and hand off

**Evidence, all one direction:**

| Source | Says |
|---|---|
| PRD p.8 | *"The app drafts the follow-up email. The user reviews and sends."* |
| PRD p.13 | *"App drafts a one-line follow-up email — user reviews and sends"* |
| PRD p.16 | *"App drafts the email, user sends"* |
| Designer, plate 08 | *"Copy and hand off instead."* |
| Plate 08, on-screen | *"Trackr doesn't send email for you."* |

⚠️ **The failure mode that decides it:** a new domain has no sender reputation. Mail from `mail.trackr.app` with `Reply-To` elsewhere is a textbook spam pattern. If it lands in spam, **the follow-up never arrives and the user believes it did** — they stop chasing, thinking they've chased. A silent failure in the product's core loop.

**MVP: draft + copy button + "Mark as sent".** Revisit sending in v2 once the domain has reputation.

**If you keep both tiers (L038):** the Pro send path needs a confirmation state, a sent state, a bounce/failure state, and `contact_email` verification before it can be a `Reply-To`. None are designed.

---

# 6 · AI DRAFTING — two prompts

Extends `AI-RULES.md` §6.2, which specced only R1.

## R1 — application follow-up

> Write a brief, polite follow-up on a job application. Two to three sentences. Reference the specific role and the time elapsed. Never pushy, never apologetic. No subject line.

## R2 — post-interview follow-up

> Write a brief thank-you following a job interview. Two to three sentences. Reference the role and, if provided, one specific point from the conversation. Warm but professional. No subject line.

⚠️ **R2 may receive call-log notes as input.** Same prompt-injection rules apply — delimited data blocks, never concatenated instructions (`SECURITY_quarterfinal.md` §13).

**Both:** under 800 characters. **Neither consumes generation quota** (L055) — counting them makes users ration follow-ups, the exact behaviour the product exists to encourage.

---

# 7 · FRONTEND

| ID | Component | Notes | Env |
|---|---|---|---|
| **F4-3.1** | `ReminderQueue` | Two sections — Due now · Upcoming. Row: company, role, days elapsed, type. ⏸ **wireframe only, no mockup** | ✅ |
| **F4-3.2** | `DraftPane` | Editable textarea + Copy · Snooze · Dismiss · Mark as sent | ✅ |
| **F4-3.3** | `SnoozeControl` | **Tomorrow · 3 days · 1 week · Pick a date** | ✅ |
| **F4-3.4** | `RemindersBadge` | Count on the sidebar nav item — your decision. `bg-[--color-accent]`, mono 9.5, `aria-label="3 reminders due"` | ✅ |
| **F4-3.5** | `RemindersTab` | Fills M05's shell (F2-3.19) | ✅ |
| **F4-3.6** | `SetReminderAction` | Wires M05's inert button | ✅ |
| **F4-3.7** | `FollowUpTag` | Makes M03's tag clickable → the draft flow | ✅ |

## Snooze durations — reasoning

| Option | Covers |
|---|---|
| **Tomorrow** | "I'm busy right now" — deferring the task |
| **3 days** | Mid-week check |
| **1 week** | "Too early to chase" — matches job-search follow-up cadence |
| **Pick a date** | A stated timeline or a scheduled call |

Drop "3 days" if you want three — it's the least distinct.

⚠️ **F4-3.1 has no mockup.** Plate 08 is wireframe-only. Build from structure; expect revision when it's designed.

---

# 8 · WHERE THESE TASKS SLOT IN

| Document | Add |
|---|---|
| `DATABASE_quarterfinal.md` | §3.3 `reminders` · `applications.follow_up_snoozed_until` · deletion graph · `idx_reminders_queue` |
| `TASKS_quarterfinal.md` | F4 group — 15 tasks |
| `AI-RULES.md` | §6.2 gains the R2 prompt |
| `F4-SCREEN-MAP.md` §3 | derived-tag query updated for both rules + snooze |
| `SECURITY_quarterfinal.md` §14 | soft-delete filter applies to the reminder queue |

**Total: 15 tasks** — 2 database · 4 API · 2 scheduler · 7 frontend.
**14 local-complete · 1 config-only** (notification transport).

---

# 9 · OPEN

| | Question |
|---|---|
| 1 | **L038 — confirm copy-only, or keep the Pro send path?** Evidence in §5 is one-sided |
| 2 | R2 window — 24 hours, or 48? PRD says *"24–48 hours"* |
| 3 | Does R2 fire if `interview_at` was never set? The user may not log the interview time |
| 4 | Should `Set a reminder` (M05) create a custom reminder, or only view scheduled ones? |
| 5 | Snooze — does it also delay the email notification, or only hide the tag? |

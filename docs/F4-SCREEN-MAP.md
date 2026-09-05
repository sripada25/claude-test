# F4-SCREEN-MAP.md — Follow-up system

Which screens F4 touches, what it needs from each, and what exists today.

**F4 has no mockup.** Plate 08 "Follow-up" (`Y1xzAR`) is wireframe-only. Everything below comes from the designer's notes, the PRD, and F4 elements already present in the M01–M06 mockups.

---

# 1 · SUMMARY

| Screen | F4 presence | Built? |
|---|---|---|
| **Sidebar** | `Reminders` nav item — lucide `bell` | ⬜ placeholder screen |
| **M03 Board** | `Follow up` tag on cards — **derived state** | ⬜ |
| **M05 Detail** | Reminders tab · "Set a reminder" action · timeline events | ⬜ shells |
| **Plate 08** | The follow-up queue screen itself | ⏸ wireframe only |
| M01 · M02 · M04 · M06 | none | — |

**F4 is visible on three of the six mockups and has a screen of its own that hasn't been designed.**

---

# 2 · SIDEBAR — `Reminders`

**Source:** `M/Sidebar` (`ErsAL`), fourth nav item.

🎨 Icon lucide `bell` `17×17` · label "Reminders" body `13.5`/500 `$m-sidebar-ink` · route `/app/reminders`

**Today:** renders as a placeholder screen (your N7 decision — nav items exist, screens are stubs).
**F4 fills it** with plate 08's queue.

⚠️ **A count badge is not drawn.** Most reminder systems show one — "Reminders 3". Worth asking your designer, since the whole point is not missing them.

**References:** SB-03 · N7 · Mockup 03

---

# 3 · M03 BOARD — the `Follow up` tag

**Source:** `qSU0e`, Razorpay card — tags `7d` and `Follow up`.

🎨 Fill `$m-accent-soft` · text mono `9.5`/600 `$m-accent` · padding `[3,7]`
**The only accent-coloured tag on the board.** Every other tag is `$m-surface-2`.

## 🔴 It is a derived state, not a stored flag

**Designer's note, plate `iHpHi`:**

> *"Follow-up flag is the product's core loop. Fires 7 days after the applied date. It's a state on the card, not only a notification, so it survives a missed email."*

```sql
status IN ('applied','assessment','interview')
AND date_applied < now() - interval '7 days'
AND NOT EXISTS (
  SELECT 1 FROM application_events
  WHERE application_id = a.id AND type = 'follow_up_sent'
)
```

⚠️ **If it read from a `reminders` row, a failed email send would mean the card never flags** — and the loop the product exists to provide fails invisibly. Deriving it from the application's own dates makes it resilient, which is exactly what the note says.

## It is clickable

🔧 A `<button>`, not a badge — navigates to the follow-up draft flow. Needs button semantics, focus ring, and a 44px touch target.

**Consequence for F2:** the board query must compute this. It's covered by `idx_applications_board (user_id, status, last_activity_at DESC)`, with the date comparison in the `WHERE`.

**References:** M03-09 · F2-3.4 · Mockup 03

---

# 4 · M05 DETAIL — three touchpoints

**Source:** `yYHoM`.

## 4.1 · Reminders tab

🎨 Fourth tab, label "Reminders 1" — the count is part of the label string, not a badge.
**Today:** an empty shell (F2-3.19). **F4 fills it** with that application's reminders.

## 4.2 · "Set a reminder" action

🎨 Right column, fourth button. Secondary variant — fill `$m-surface`, stroke `$m-border-strong`, icon lucide `bell-plus` `15×15`.

**Designer's note, plate `Rzt0J`:** *"The right column is the action surface. Generation, call logging and reminders all start here because this is the screen the user is on when they remember."*

**Today:** rendered, inert. **F4 wires it.**

## 4.3 · Timeline event

🎨 Icon lucide `mail`, colour `$m-primary`, text "Follow-up email sent".

Written to `application_events` with `type = 'follow_up_sent'` — **the same row the derived tag in §3 checks for.** One write serves both the timeline and the board.

**References:** M05-05 · M05-09 · M05-07 · Mockup 05

---

# 5 · PLATE 08 — the follow-up screen

⏸ **Wireframe only. No mockup.** Structure read from `Y1xzAR`; visual spec unavailable.

**Layout:** two panes — queue left, draft right.

**Queue:** `Due now` and `Upcoming` sections, each row showing company, role, and days elapsed.

**Draft pane:** the generated follow-up text, editable, with actions.

**Designer's notes, verbatim:**

> *"Sending on the user's behalf means mailbox OAuth, deliverability, and an entire class of trust and abuse problems. Copy and hand off instead."*

> *"Snooze is offered alongside Dismiss, or the follow-up loop quietly stops working."*

⚠️ **On-screen copy reads: "Trackr doesn't send email for you."**

## 🔴 This contradicts your L038 decision

You chose **both** — draft + copy on free, send via a provider with `Reply-To` on Pro — because showing send capability matters to a prospect or investor.

**The design assumes copy-only**, in on-screen copy, not just a note. So:

1. That line must change if Pro sends
2. **The Pro send path has no design at all** — no confirmation, no sent state, no failure state
3. Your designer should know before he mocks plate 08

## Snooze

The note is emphatic: without Snooze beside Dismiss, users dismiss reminders they aren't ready to act on, and the loop stops. **Snooze is not optional.**

**Needs:** `reminders.snoozed_until TIMESTAMPTZ` and a snooze-duration choice (tomorrow / 3 days / next week).

**References:** L038 · plate `Y1xzAR`

---

# 6 · WHAT F4 NEEDS THAT DOESN'T EXIST

| | Status |
|---|---|
| `reminders` table | ❌ not in `DATABASE_quarterfinal.md` |
| `snoozed_until` column | ❌ |
| Follow-up draft generation | ✅ specced in `AI-RULES.md` §6.2 — **does not consume quota** (L055) |
| Send path (Pro) | ❌ no design, no tasks |
| Scheduler — fires 7 days after `date_applied` | ❌ |
| Send queue | ⚠️ decided (L036) — reminders cluster in a morning batch and the provider's daily cap must be spread |
| Timezone-correct firing | ✅ `users.timezone` exists (L041) |
| Reminders count badge | ❌ not drawn |
| `follow_up_sent` event type | ✅ in `application_events` enum |

---

# 7 · THE DEPENDENCY THAT MATTERS

**F2 must compute the `Follow up` tag before F4 exists.**

The tag is derived from `applications` and `application_events` — both F2 tables. It does not depend on a `reminders` row.

So the board can show follow-up state with **no F4 code at all**. F4 then adds the queue screen, the drafting, and the sending.

⚠️ **This is why the derived-state decision matters beyond correctness** — it lets the product's core loop work from F2 onward, rather than waiting for F4.

---

# 8 · OPEN

| | Question |
|---|---|
| 1 | Does the sidebar `Reminders` item show a count badge? |
| 2 | Plate 08 says "Trackr doesn't send email for you" — **contradicts L038.** Tell the designer before he mocks it |
| 3 | Snooze durations — tomorrow / 3 days / next week? |
| 4 | Does a snoozed reminder still show the `Follow up` tag on the board? |
| 5 | Is the 7-day window configurable, or fixed? PRD says 7 (p.13) |

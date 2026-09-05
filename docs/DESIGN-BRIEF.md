# DESIGN-BRIEF.md — Requirements for the UX Designer

Everything currently blocking or waiting on design work, organized by priority. Written for design decisions, not implementation — no code, no schema.

**Admin console is on hold** — not included here, picked up separately when that work resumes.

---

# HOW TO USE THIS

Each item states: what exists today, what's missing or ambiguous, and what a resolved answer looks like. Where I have a recommendation, it's marked — treat it as a starting point, not a constraint.

---
---

# 1 · 🔴 HIGH PRIORITY — actively blocking build work

## 1.1 · Interaction states — confirm scope

**Status:** You've added `M/Button — Focus`, `M/Button — Disabled`, `M/Field — Focus`, `M/Field — Disabled`, `M/Field — Error`, `M/Checkbox — Focus`, `M/Checkbox — Disabled` to the file. This is exactly what was missing.

**Need confirmed:** are these **universal** — i.e., the answer for every screen (M01–M06), not just what you were working on when you added them? If universal, nothing further needed from you here. If they were added with a specific screen in mind, say which, so we don't misapply them elsewhere.

## 1.2 · Salary period control (Profile builder, M02)

**What exists:** the salary field renders as one string — "28,00,000 / year".

**What's missing:** the underlying data model has three separate values — amount, currency, and a period (monthly vs. annual). The mockup doesn't show how the user picks the period.

**Need:** either (a) a visible control — a toggle or dropdown for monthly/annual next to the amount field, or (b) confirmation that annual is the only supported period for MVP and "/ year" is fixed text, not a choice.

## 1.3 · Source field (Add application, M04)

**What exists:** the pipeline board (M03) has a "Source" filter, and the detail screen (M05) displays "Source: LinkedIn" as a chip. Neither screen shows where this value is entered.

**Need:** a field in the Add Application form — likely a dropdown (LinkedIn / Naukri / Indeed / Referral / Company site / Other) sitting near the existing "Source URL" field, ideally pre-selectable but user-correctable.

## 1.4 · Follow-up screen (plate 08) — needs a real mockup

**What exists:** a wireframe only, with a note stating the app doesn't send email on the user's behalf.

**What's changed:** the product now supports **two tiers of behavior** — free users draft and copy manually; paying users can click to send automatically from the pipeline board itself.

**Need:**
- Updated on-screen copy — the current wireframe text ("Trackr doesn't send email for you") no longer matches the product
- A **confirmation state** before an automatic send goes out — what does the user see in the moment between clicking and the email leaving?
- A **sent** state — how does the user know it went, both on this screen and back on the pipeline card?
- A **failure** state — what if the send fails? (Bounced address, provider outage, etc.)
- The **automatic-send button itself**, as it appears on a pipeline card (per your confirmation, it lives on the card within its status column) — icon, label, and how it differs visually from the free-tier "draft" version of the same control

## 1.5 · Post-call log screen (plate 07) — needs a real mockup

**What exists:** wireframe only. Structure implied: pick an application, answer three questions, optionally let AI structure the notes, review before saving.

**Need:** the actual visual design — this is one of only two screens (with follow-up) still wireframe-only, and it's a core MVP feature per the product spec.

---
---

# 2 · 🟠 MEDIUM PRIORITY — needed before those screens are finished, not urgent yet

## 2.1 · Card tag overflow (Pipeline board, M03)

**What exists:** cards show 1–2 small tags (age, "Follow up", "Doc", a due date or call time). No card in the current mockup shows more than 2.

**What's missing:** the data can produce up to 4 tags on one card at once. There's no shown behavior for what happens when it doesn't fit.

**Need:** a treatment for overflow — a "+2 more" indicator, or a decision on which tags take priority when space is tight (our working assumption: the follow-up indicator always wins a visible slot, since it's the one actionable tag).

## 2.2 · Result card text treatment (Generate document, M06)

**What exists:** the generated cover letter's opening line and sign-off are styled slightly heavier than the body paragraphs.

**What's uncertain:** AI-generated text doesn't reliably follow a fixed structure — sometimes there's no clean "Dear X," opener to style differently. Applying special styling to a part that isn't reliably present could look broken as often as it looks good.

**Need:** either confirm the whole result reads fine as uniform text (simplest, our recommendation), or provide a rule the app can apply consistently regardless of what the AI actually generates.

## 2.3 · Top bar height — pick one

**What exists:** the app's top bar has been drawn at three different heights across three screens (Pipeline board, Detail, Generate document).

**Need:** one height for all of them. We'd suggest whichever comfortably fits your search input plus normal padding — happy to use a number you provide.

## 2.4 · Marketing site (F0) — no design exists yet

**What exists:** nothing. Referenced only as a page list — home, pricing, about, terms, privacy.

**Need:** whenever you have capacity — this is lower priority than the app screens above, since it's not blocking any in-progress build work. Just flagging that it's fully open.

---
---

# 3 · 🟡 LOWER PRIORITY — worth answering, nothing currently waiting

## 3.1 · Mobile / responsive behavior

**What exists:** all screens are designed at desktop width (1440px). We've made reasonable assumptions for how each adapts to a phone screen — sidebar becomes a slide-out drawer, the two-column detail screen stacks, the board scrolls sideways rather than shrinking cards.

**Need, if you have time:** a look at whether those assumptions match what you'd actually design, particularly for:
- The pipeline board on a phone (cards likely need to be tappable at a comfortable size — a couple of the smaller buttons we found were too small for a fingertip and we've widened them ourselves; worth a design pass to confirm we widened them sensibly)
- The add-application drawer, which we've assumed becomes full-screen below tablet width

## 3.2 · Payment / checkout flow (F6)

**What exists:** a pricing summary on the settings screen only.

**Need:** eventually — the actual subscribe flow, payment confirmation, and what a failed or expired subscription looks like to the user. Not urgent; this is the last feature in the build order regardless.

## 3.3 · Empty and loading states, generally

**What exists:** most screens show their "full of data" state only.

**Need, low urgency:** a first-time-user empty state for the pipeline board (zero applications), and a loading placeholder for the ~5-second wait while a document generates. We can reasonably improvise both, but if you have a preferred visual language for these (skeleton screens, illustrations, plain text) let us know before we lock one in.

---
---

# 4 · CONSISTENCY NOTES — not questions, just flagging so nothing looks accidental

- The "secondary" button style (light background, visible border) now appears on four different screens with identical treatment each time — confirming this is intentional and can be treated as a standing pattern, not something to vary per screen.
- Corner styling is square throughout every screen we've checked — confirming this is deliberate (not a default that was never changed) so we don't second-guess it later.
- The generate/regenerate buttons are quite small relative to how often they'll be tapped on mobile — flagged in 3.1 above, but calling it out separately since it's the one place we adjusted your spec rather than just filling a gap.

---
---

# 5 · WHAT'S ALREADY SETTLED — no action needed, listed for your awareness

So you know what's locked and won't move under you:

- Colors, type, spacing, and icon system are being pulled directly from your file — any value we use should already match what you drew
- The follow-up "tag" on pipeline cards is calculated automatically by the app (it appears/disappears based on dates), not something a user sets manually — this was your own design intent and we've built to it exactly
- Six main app screens (sign-in, profile builder, pipeline board, add application, application detail, generate document) are fully specified and being built now — no open questions remain on any of those six beyond the items listed above

---
---

# PRIORITY SUMMARY — if you only have time for a few of these

1. Confirm the interaction states (§1.1) — five-minute check
2. Source field placement (§1.3) — small addition to an existing screen
3. Salary period control (§1.2) — small addition to an existing screen
4. Follow-up screen (§1.4) — the biggest piece of new work, and the one with the most open sub-questions
5. Post-call log screen (§1.5) — the other fully-open screen

Everything in sections 2 and 3 can wait without blocking anything currently in progress.

# DESIGN-WORK-BRIEF.md — Trackr

Design work needed, written for a design tool working in `Admin.pen` / `untitled.pen`.

**Style is already established.** Every existing screen uses the same tokens, typefaces, spacing, and component set. New work should reuse them, not introduce new patterns. The relevant conventions are restated in §0 so nothing has to be inferred.

Items are ordered by what's blocking implementation, not by size.

---

# 0 · CONVENTIONS TO FOLLOW

These are already true of every existing screen. New screens must match.

**Colour tokens** — use the `$m-` set, never raw hex except for third-party brand marks (Google blue, LinkedIn blue, which are correctly hardcoded).

**Typefaces** — Archivo (display, headings) · IBM Plex Sans (body) · IBM Plex Mono (labels, chips, counters).

**Corners** — square. No corner radius anywhere in this product. Verified across 253 nodes; it's deliberate.

**Shadows** — none, with one exception: modals carry `0 14px 36px` at `#15181C40`. Everything else is flat with borders only.

**Icons** — Lucide.

**App chrome height** — 64px for top bars. Three existing screens were drawn at 56, 60, and 68; these are being normalised to 64.

**Existing component set** — `M/Button`, `M/Field`, `M/Tag`, `M/Checkbox`, `M/Avatar`, `M/Nav item`, `M/Sidebar`, plus the state variants `M/Button — Focus/Disabled`, `M/Field — Focus/Disabled/Error`, `M/Checkbox — Focus/Disabled`. Reuse these; don't create parallel versions.

**Established state values:**
- Focus: 2px **inner** stroke — `$m-accent` on buttons, `$m-primary` on fields and checkboxes
- Disabled: `$m-surface-2` fill with `$m-muted` text — a colour change, not opacity
- Error: field border `1.5px $m-danger`, plus a row below with a `circle-alert` icon (12px) and mono 10.5px message, both `$m-danger`

---
---

# 1 · 🔴 BLOCKING IMPLEMENTATION

## 1.1 · Payment Failed modal — revise the existing draft

**Exists:** `Mockup — 09d Settings · Payment Failed` (frame `tQ6ew`)

**Why it needs work:** it reads as a first pass rather than a finished screen. Specifically:
- The subtitle text is the words "Payment Failed" repeated — placeholder, not real copy
- The transaction ID shows `TRID-123456sdafasfasdf!@#$` — obviously placeholder text
- **There is no Retry action.** The only button is Close, which dead-ends a user whose payment failed

**What's needed:**
- Real failure copy. Payments fail for different reasons and the message should reflect that — a declined card and a cancelled payment are different situations. Either one message that works for all cases, or a small set of variants.
- **A Retry button**, primary emphasis, alongside Close. A user who just failed to pay should be one click from trying again, not sent back to Settings to start over.
- A realistic transaction ID format — Razorpay's actual ID shape, or a clearly-formatted placeholder that reads as an ID rather than keyboard mashing.

**Reuse:** the same modal shell as `09b Upgrade checkout` — 400px wide, same backdrop, same header structure.

---

## 1.2 · Subscription Expiry screen — currently empty

**Exists:** `Mockup — 09 Settings & plan - Subscription Expiry` (frame `i4du8`)

**Why it needs work:** the canvas is 1120px tall (versus 900 for every sibling Settings screen), but **all four content sections are identical to the base Settings screen.** Free still shows as `CURRENT`. Nothing expiry-specific exists anywhere in the frame. It looks like the screen was duplicated as a starting point and the actual content was never added.

**What's needed — the question this screen should answer:** what does a user see when their Pro subscription has lapsed?

Elements to consider:
- A notice explaining what happened and when — the plan expired, and on what date
- Whether there's a grace period, and if so, what the user retains during it
- What they've lost access to now (document generation drops to the free 5/month limit; tracking stays unlimited)
- A clear path back — a Renew or Upgrade action

**Tone note, and this matters:** existing copy on the quota-exhausted banner does this well — *"They reset on 1 Sept. Tracking stays unlimited — this only affects new document generation."* It states the situation and what still works, without blaming the user. The expiry screen should read the same way, not as a warning or a penalty.

---

## 1.3 · Pro follow-up send — three states, none exist

**Context:** the product has two follow-up behaviours. Free users get a drafted email they copy and send themselves. **Paying users can click a control on a pipeline card and have the email sent automatically.** The second path has no design at all.

**Note:** the existing follow-up wireframe (plate 08) says *"Trackr doesn't send email for you"* — that copy is now out of date and will need revising when this screen is designed.

**What's needed — three states:**

**Confirmation** — what the user sees between clicking send and the email going out. This is a one-way action reaching a real recruiter, so a confirmation step is appropriate. Show them what's about to be sent and to whom.

**Sent** — how the user knows it worked. Needed in two places: on this screen, and reflected back on the pipeline card the action was triggered from.

**Failure** — the email didn't send (bad address, provider problem). Needs to be recoverable, not a dead end — the same reasoning as the Payment Failed retry above.

**Also needed:** the send control itself, as it appears on a pipeline card. Currently the card shows a `Follow up` tag in accent colour; the Pro version needs to read as clickable and be visually distinguishable from the free-tier draft version of the same control.

---
---

# 2 · 🟠 NEEDED SOON

## 2.1 · Cancellation flow

**Why:** the upgrade checkout modal's fine print says *"Cancel anytime from Settings."* No cancellation flow exists anywhere in the file.

**What's needed:**
- Where cancellation lives in Settings (presumably the Plan & billing section)
- Confirmation before cancelling — this is destructive from the user's perspective
- What the user sees afterward: does access continue until the period ends, or stop immediately?
- Post-cancellation state of the Plan section

---

## 2.2 · Post-call quick log screen (F5)

**Exists:** wireframe only (plate 07). No mockup.

**Structure implied by the wireframe:** the user picks which application the call was about, answers three short questions, optionally lets AI structure the notes, then reviews before saving.

**Two things the wireframe notes establish that should carry into the mockup:**
- Application selection comes **first** — before the questions
- AI structuring is **optional**; saving a plain unstructured note must always work and shouldn't feel like a lesser path
- The review step before saving is deliberate — extracted values are editable, not final

---
---

# 3 · 🟡 SMALL, SPECIFIC

## 3.1 · Sidebar nav item — focus state

**The gap:** state variants exist for `M/Button`, `M/Field`, and `M/Checkbox`, but not for `M/Nav item`.

**Why it matters:** the sidebar is dark (`$m-sidebar`, near-black navy). The focus colour used on buttons (`$m-accent`) and on fields (`$m-primary`) may not read clearly against it — `$m-primary` in particular is a dark navy that would nearly disappear.

**What's needed:** a `M/Nav item — Focus` variant, with a focus indicator that's clearly visible against the dark sidebar background. A light or white indicator is likely the right answer, but that's a design call.

---

## 3.2 · Salary period control — profile builder

**Exists:** `Mockup — 02 Profile builder`, the salary field currently renders as one string — "28,00,000 / year".

**The gap:** monthly versus annual is a real choice the user needs to make, and there's no control for it. The "/ year" text is currently fixed.

**What's needed:** a small monthly/annual toggle alongside the currency selector and amount input. The location-preference control on the same screen (Remote / Hybrid / On-site) is the natural pattern to reuse.

---

## 3.3 · Source field — add application drawer

**Exists:** `Mockup — 04 Add application`.

**The gap:** the pipeline board has a "Source" filter, and the application detail screen displays a "Source: LinkedIn" chip — but the add-application form never collects this value. It's displayed and filtered but never entered.

**What's needed:** a Source dropdown in the Add Application form, near the existing Source URL field. Options: LinkedIn, Naukri, Indeed, Referral, Company site, Other.

---

## 3.4 · Card tag overflow — pipeline board

**Exists:** `Mockup — 03 Pipeline board`. Cards show 1–2 small tags.

**The gap:** a card can legitimately have up to four tags at once — an age indicator, a follow-up flag, a document indicator, and a stage-specific date. The card is 200px wide; two tags already fill the row.

**What's needed:** a treatment for overflow. Something like a "+2" indicator, plus a view on which tags take priority when space runs out. The follow-up flag is the only actionable one, so it likely always earns a visible slot.

---

## 3.5 · Settings nav active state — confirm intentional

**Observation, not necessarily a problem:** the Settings screen's left nav marks the active item with a 2px left border and a `$m-primary-soft` fill. The main app sidebar marks its active item with a 3px accent-coloured left rail.

Both are "selected nav item" but rendered differently. If that's deliberate — distinguishing sub-navigation from primary navigation — no change needed. If it's incidental, worth aligning.

---
---

# 4 · CONTEXT: WHAT'S ALREADY SETTLED

So nothing here gets accidentally redesigned:

- **Six main app screens are complete and being built against** — sign-in, profile builder, pipeline board, add application, application detail, generate document. Only the specific gaps listed above are open on those screens.
- **The payment checkout flow is done** — upgrade modal, billing cycle toggle, verifying state. Only the failure state (§1.1) needs revision.
- **Admin console screens are complete** — sign-in and dashboard. On hold, not currently being built.
- **The follow-up tag on pipeline cards is calculated automatically** by the app based on dates — it appears and disappears on its own, it's not something a user sets. That behaviour is already correct as designed.

---

# 5 · IF ONLY A FEW OF THESE

Priority order, if capacity is limited:

1. **§1.1 Payment Failed** — smallest of the blocking items, mostly copy plus one button
2. **§3.3 Source field** — one dropdown, unblocks two other screens that already reference it
3. **§3.2 Salary period** — one small control on an existing screen
4. **§1.2 Subscription Expiry** — a real screen to design, but the canvas already exists
5. **§1.3 Pro send states** — the largest piece, three related states plus a card control

Everything in §2 and the rest of §3 can wait without blocking work in progress.

# DESIGN-REQUESTS.md — Trackr

Design work needed, written for direct action in pen.dev.

**Existing file:** `Admin.pen` (contains the main app screens 01–09 plus the payment flow) and `untitled.pen` (the original six mockups).

**Design system already established** — reuse, do not invent:

```
Colours       $m-primary #16324F · $m-accent #C6602C · $m-bg #F5F3EF
              $m-surface #FFFFFF · $m-surface-2 #EFEBE3
              $m-border #DBD5C9 · $m-border-strong #C2BAA9
              $m-ink #1B1B18 · $m-ink-2 #54524A · $m-muted #8B8778
              $m-danger #AE3B2C · $m-danger-soft #F1DFD9
              $m-success #1F7A4D · $m-success-soft #DEEDE2
              $m-warning #A6740F · $m-warning-soft #F2E7CE

Fonts         Archivo (display) · IBM Plex Sans (body) · IBM Plex Mono (labels)
Icons         Lucide
Corners       Square — no corner radius anywhere in this system
Shadows       None, except modals (0 14px 36px #15181C40)
Components    M/Button · M/Field · M/Tag · M/Checkbox · M/Avatar · M/Nav item · M/Sidebar
              plus verified state variants: — Focus, — Disabled, — Error
```

Items are ordered by what's blocking implementation work.

---
---

# 1 · PAYMENT FAILED — revise existing screen

**Existing frame:** `Mockup — 09d Settings · Payment Failed` (`tQ6ew`)

**What's wrong with the current version:**

1. The subtitle text repeats the heading — both say "Payment Failed." The subtitle needs real explanatory copy instead.
2. **There is no Retry action** — only a Close button. A failed payment currently dead-ends the user with no way to try again.
3. The receipt panel shows a placeholder transaction ID: `TRID-123456sdafasfasdf!@#$`

**What's needed:**

- **Subtitle copy** explaining what happened, in plain language. Likely variants worth showing: card declined by the bank · payment cancelled by the user · a network/timeout failure. If one generic message is preferred over variants, that's fine — but it should say something more useful than the heading.
- **A Retry button**, primary treatment, alongside the existing Close. Retry should be the more prominent of the two.
- **A realistic transaction ID format.** Razorpay's real format is `pay_` followed by an alphanumeric string (e.g. `pay_NkL8xY2mQwPz4R`).
- **Support contact affordance** — worth considering, since a user whose payment fails twice needs somewhere to go.

**Reuse:** the same modal shell as `09b Upgrade checkout` — 400px wide, `$m-surface`, drop shadow, close icon top-right.

---

# 2 · SUBSCRIPTION EXPIRY — screen exists but is empty

**Existing frame:** `Mockup — 09 Settings & plan - Subscription Expiry` (`i4du8`)

**Current state:** the canvas is 1120px tall (220px taller than the standard Settings screen), but **all four content sections — Account, Plan, Notifications, Data & privacy — are identical to the base Settings screen.** Free still shows as CURRENT. There is no expiry-specific content anywhere in the frame.

It reads as a duplicate created as a starting point, with the extra height reserved for content not yet added.

**What's needed — the actual question this screen should answer:**

> What does a user see when their Pro subscription has lapsed?

Specifically:

- **A notice or banner** — where does it sit? Above the Settings nav, or inside the Plan panel?
- **What it says** — e.g. the date it expired, what they've lost access to, what still works
- **Is there a grace period?** If Pro features remain available for some days after expiry, the design needs to communicate that distinctly from a hard cutoff
- **How the Plan panel changes** — does Free now show as CURRENT with Pro showing a "Renew" rather than "Upgrade" action?
- **Renewal action** — same checkout modal as `09b`, or a distinct renewal path?

**Reuse:** `$m-warning` / `$m-warning-soft` for a soft expiry warning, or `$m-danger` / `$m-danger-soft` if the framing is harder. The existing Settings layout and nav should stay unchanged.

---

# 3 · PRO FOLLOW-UP SEND — three states, none exist

**Context:** the product has two follow-up tiers.

- **Free:** the app drafts a follow-up email; the user copies it and sends manually from their own email client
- **Pro:** clicking the `Follow up` control on a pipeline card sends the email automatically

**The existing wireframe (plate 08) contradicts this** — its on-screen copy says *"Trackr doesn't send email for you."* That line was written when copy-only was the plan. It needs updating, and the Pro path needs designing.

**What's needed — three states that don't currently exist anywhere:**

**3a · Confirmation, before sending**
The user clicks send. What do they see before the email actually goes out? A preview with a confirm button, or an inline confirmation? This matters: an automatic send with no review step means AI-generated text reaches a real recruiter unread.

**3b · Sent state**
How does the card and/or the follow-up screen show that an email has gone? Where does the "sent" indicator live on the pipeline board card, and on the application detail timeline?

**3c · Failure state**
Send failed — bounced address, provider error. What does the user see, and what can they do about it?

**Also needed:** the `Follow up` control **as it appears on a pipeline card** — it currently exists as an accent-coloured tag (`$m-accent-soft` fill, `$m-accent` text, mono 9.5px). If Pro users click it to send, it needs to read as an action rather than a status label, and needs to visibly differ from the Free tier's version of the same control.

---

# 4 · CANCELLATION FLOW — referenced but never designed

**Where it's referenced:** the checkout modal's fine print says *"Cancel anytime from Settings."*

**What exists:** nothing. There is no cancellation control on the Settings screen, and no confirmation or post-cancellation state.

**What's needed:**

- **Where cancellation lives** in Settings — presumably the Plan section, but it isn't there now
- **Confirmation step** — cancelling a paid subscription is destructive enough to warrant one
- **What the user is told** — when access actually ends (immediately, or at the end of the paid period?), and what happens to their data
- **Post-cancellation state** of the Plan panel

**Reuse:** the `$m-danger`-stroked button treatment already used for "Delete my account and all data" in the Data & privacy section — cancellation is destructive but less so than account deletion, so a similar but not identical weight seems right.

---

# 5 · F5 POST-CALL QUICK LOG — wireframe only, needs a mockup

**Existing frame:** plate `07 — Post-call quick log` (`b9cVNO`) — wireframe fidelity only, no mockup version exists.

**What the wireframe establishes** (keep this structure):

1. **Select which application** the call was about — this comes first
2. **Three questions** — who called, what was discussed, what's the next step
3. **Optional AI structuring** — a checkbox; saving as a plain note always works and costs the user nothing
4. **Editable preview** before saving, headed "PREVIEW — CHECK BEFORE SAVING"

**What's needed:** the mockup-fidelity version using `M/` components and the real colour system, same as screens 01–06.

**Two specific things the wireframe leaves unclear:**

- **The AI structuring toggle's states** — unchecked (plain note), checked-and-processing, checked-and-complete-with-editable-output
- **What happens when AI structuring fails** — the plain note must still save

---

# 6 · SIDEBAR NAV ITEM — focus state missing

**Small but blocking:** `M/Button — Focus`, `M/Field — Focus`, and `M/Checkbox — Focus` all exist and are being used. **`M/Nav item` has no focus variant.**

**Why it can't be inferred:** the established focus treatment is a 2px inner stroke — `$m-accent` for buttons, `$m-primary` for fields. Neither works on the sidebar: `$m-primary` (#16324F) against the sidebar background (#132638) is roughly 1.3:1 contrast, effectively invisible.

**What's needed:** a `M/Nav item — Focus` variant. White (#FFFFFF) or `$m-sidebar-ink` (#C7D3DC) would both meet contrast requirements against the dark sidebar — whichever fits the system better.

**Note:** this must be visually distinct from the existing *active* state (which uses `$m-sidebar-2` fill plus a 3px `$m-accent` left rail), since a nav item can be both focused and active simultaneously.

---
---

# 7 · SMALLER ITEMS

## 7a · Salary period control — Profile builder (`02`)

The salary field currently renders as one string: `28,00,000 / year`. The data model stores amount, currency, and period as three separate values — so a **period control (monthly / annual)** needs to exist visually.

Suggested: reuse the same selected/unselected treatment as the Location preference control on the same screen (`$m-primary` filled when selected, `$m-surface` with `$m-border-strong` when not).

## 7b · Source field — Add application (`04`)

The pipeline board has a **Source filter**, and the application detail screen shows a **"Source: LinkedIn"** chip — but the Add application form never collects this value.

**Needed:** a Source dropdown in the Add application drawer, near the existing Source URL field. Options: LinkedIn · Naukri · Indeed · Referral · Company site · Other.

## 7c · Password visibility toggle — Sign in (`01`)

An eye icon inside the password field to show/hide the entered text. Standard pattern, currently not drawn.

Lucide icons: `eye` and `eye-off`.

## 7d · Card tag overflow — Pipeline board (`03`)

Cards are 200px wide and can carry up to four tags at once (age, Follow up, Doc, plus a stage-specific date like "Due Fri" or "Tue 3pm"). Two tags already fill the available width.

**Needed:** an overflow treatment — likely showing 2 tags plus a `+2` indicator. Which tags take priority when space runs out is worth deciding: the `Follow up` tag is the only actionable one, so it arguably always keeps its slot.

## 7e · Top bar height — inconsistent across screens

The app top bar is currently drawn at three different heights: 68px on the Pipeline board, 60px on Application detail, 56px on Generate document. The Settings screen uses 64px.

**Needed:** one height across all app screens. 64px is being used as the working value since it comfortably fits the tallest control (the board's 36px search input) and matches the newest screen.

## 7f · Generated document text treatment — Generate document (`06`)

The result card styles the opening salutation and the sign-off at weight 600, with body paragraphs at normal weight.

**The concern:** this text is AI-generated and doesn't reliably follow a fixed structure — there isn't always a clean "Dear X," to style differently. Applying special styling to a part that may not exist could look broken.

**Needed:** either confirmation that uniform body-weight text is acceptable for the whole result, or a rule that works regardless of what the AI actually generates.

---
---

# 8 · NOT NEEDED — already resolved

Listed so no time is spent re-solving these:

- ✅ **Focus, disabled, and error states** for Button, Field, and Checkbox — the `— Focus`, `— Disabled`, `— Error` variants now in the file are being used exactly as drawn
- ✅ **Square corners** — confirmed intentional (253 nodes checked, zero with a corner radius); no longer questioned
- ✅ **Checkout flow** — `09b` upgrade modal, `09c` verifying state are complete and being built against
- ✅ **Data export button** and the retention-period slot in Data & privacy — the "TBD" chip correctly marks an undecided value, which is a business decision rather than a design one

---

# PRIORITY

If time is limited, this order unblocks the most work:

1. **§6 sidebar focus state** — smallest item, blocks accessibility work on every screen with a sidebar
2. **§3 Pro follow-up states** — blocks three build tasks
3. **§1 Payment Failed** — blocks one build task
4. **§7a, 7b, 7c** — small additions to existing screens, each unblocking a form field
5. **§5 F5 mockup** — a whole feature currently has no design
6. **§2 Subscription Expiry** and **§4 Cancellation** — needed before payments ship, not before they're built

# SCREEN-NOTES-F6-PAYMENTS.md — Settings, Plan & Checkout

**Major finding:** your designer has produced F6's entire payment flow, unprompted. This closes the single biggest design gap in the project — `PRODUCT-REFERENCE_quarterfinal.md` §3 previously listed F6 as "no design exists" with nine open questions. Several of those are now answered.

Pen source: `Admin.pen` (despite the filename, these are main-app screens, not admin) · read 2026-08-27.

Five frames: `q6okB` (Settings & Plan) · `TJjUk` (Upgrade checkout modal) · `rDP3h` (Verifying payment) · `tQ6ew` (Payment Failed) · `i4du8` (Subscription Expiry — **partially read**, see §5).

---

# 1 · SETTINGS & PLAN (base screen)

🎨 Standard app chrome: `M/Sidebar` + 64px top bar, title "Settings" display `16`/600 — **confirms the 64px normalization** we'd already proposed independently across M03/M05/M06.

## Layout

```
Settings nav (180px, vertical)     Settings content (560px)
  Account   [active: $m-primary-soft fill, 2px left border]
  Profile
  Plan & billing
  Notifications
  Data & privacy
```

⚠️ **This is a different active-state pattern from the main app's sidebar** — 2px left border here, 3px accent rail there. Both are "selected nav item" but rendered differently. Worth normalizing, or confirming it's intentional to distinguish settings-nav from main-nav.

## Plan section — pricing confirmed exactly

```
Free                                    [CURRENT]
Unlimited application tracking
5 document generations / month

Pro — ₹349 / month
Unlimited document generations
₹2,999 / year — save ~28%
[Upgrade]
```

🎨 Descriptions are **mono 10.5**, `lineHeight 1.6` — a different typographic treatment from body text, giving pricing details a technical/precise feel.
🎨 "CURRENT" badge: `$m-surface-2` fill, mono `8.5`/600, `letterSpacing 0.5`.
🎨 Footer note: shield-check icon + *"Payments handled by Razorpay — UPI, cards, net banking. India only."* — **confirms India-only Razorpay decision is reflected in the actual UI copy**, not just our own ledger.

## Data & privacy — resolves a real gap

🎨 Three rows: **Export all my data** (Download button, icon `download`) · **Call transcripts kept for** [**TBD** chip] · **Delete my account and all data** (danger-stroked button).

⚠️ **The retention chip literally reads "TBD".** Your designer left it explicitly marked undecided rather than picking a number — this matches the exact open item in `DATABASE_quarterfinal.md` §11 and `PRIVACY.md`. It needs a real decision before this ships, and now there's a specific UI slot waiting for it (a dropdown, per the chevron icon).

⚠️ **Data export finally has a real design.** `PRODUCT-REFERENCE_quarterfinal.md` §7 listed this as "no task" — it now has a button, an icon, and a placement. Task should be added: `F0/F1 — data export endpoint + this button`.

⚠️ **Delete button is stroked `$m-danger`**, not filled — a lower-emphasis destructive treatment than a solid red button. Consistent with T3.8's existing cascade-delete design; just needed a visual home.

**Warning copy, verbatim:** *"Deletion removes applications, documents, call transcripts, and reminders permanently. It cannot be undone."*

---

# 2 · UPGRADE CHECKOUT — a real modal, not a page

🎨 **Modal over Settings**, not a route change. Backdrop `#15181C66` (semi-transparent dark), modal itself `400px` wide, drop shadow (`0 14px 36px`, `#15181C40`) — the **first shadow found anywhere in the entire design file**, everything else has been flat/border-only. Modals are the deliberate exception.

## Structure

```
Upgrade to Pro                                    [x]
-----------------------------------------------
BILLING CYCLE
[ Monthly        ]  [ Annual (selected) ]
  Rs.349 / mo           Rs.2,999 / yr
-----------------------------------------------
Pro - billed annually                    Rs.2,999
[UPI] [Cards] [Net banking]
[ (lock) Pay Rs.2,999 with Razorpay ]
You'll be redirected to Razorpay to complete
payment securely. Cancel anytime from Settings.
```

⚠️ **Annual is pre-selected by default** — `$m-primary-soft` fill, 2px `$m-primary` border, vs. Monthly's plain `$m-border-strong` outline. A real business choice embedded in the design: nudging toward the better-margin annual plan.

⚠️ **"Pay Rs.2,999 with Razorpay"** — the button states the provider by name and shows a lock icon. This answers one of F6's original open questions implicitly: **the flow is redirect-to-Razorpay-hosted-checkout**, not an embedded card form. Confirmed by the fine print: *"You'll be redirected to Razorpay to complete payment securely."*

**This resolves a real architectural question** — a redirect flow means Trackr never touches card details at all, which is the simplest and most secure integration pattern, and matches what `PRIVACY.md` §5 already assumed ("Razorpay hosted checkout").

**Task implication:** `POST /api/subscription/checkout` creates a Razorpay order, returns a redirect URL, client navigates there.

---

# 3 · VERIFYING PAYMENT — the webhook-race state

🎨 Same modal shell, header **without a close button** (`enabled: false` on the x icon) — the user cannot dismiss this state, only wait it out.

```
        (spinning loader)

  Verifying your payment...

Razorpay confirmed your payment. We're
finishing the last step on our end - this
takes a few seconds.

     Don't close this window
```

⚠️ **This screen exists because of the classic payment-webhook race:** Razorpay confirms the charge to the *user's browser* faster than the webhook confirming it to *your server* arrives. The copy is honest about this — "Razorpay confirmed... we're finishing the last step" — rather than pretending it's instant.

**Direct implication for the backend:** the frontend must **poll** `GET /api/subscription/status` (or hold a websocket/SSE connection) after redirect-back, waiting for the webhook to land and flip `subscriptions.status` to `active`. This is a genuinely necessary task that wasn't specified before — **F6 needs a polling or real-time confirmation mechanism**, not just a webhook handler.

**Not closable is correct** — letting a user dismiss this and navigate away mid-verification risks them believing payment failed when it's actually just delayed.

---

# 4 · PAYMENT FAILED — visibly a draft, not finished

🎨 Modal, red icon tile (x), heading "Payment Failed".

⚠️ **The subtitle literally repeats "Payment Failed"** as its own body text — this is placeholder copy, not a final message. It needs real content: why it might have failed, and — critically — **no retry button exists**, only "Close".

⚠️ **The receipt panel shows a transaction ID of `TRID-123456sdafasfasdf!@#$`** — unambiguously placeholder/test text, not a real ID format.

**What this screen needs before it's usable:**
- Real failure copy (e.g. "Your bank declined the payment" / "The payment was cancelled")
- A **Retry** action, not just Close — a failed payment shouldn't dead-end the user
- A real transaction ID format (Razorpay's actual ID scheme, once integrated)

**Flag to your designer directly** — this is the one screen in this batch that reads as an unfinished first pass rather than a considered design, unlike the other four.

---

# 5 · SUBSCRIPTION EXPIRY — confirmed: unfinished, not a completed variant

🎨 Canvas height **1120px**, versus 900px for every sibling Settings screen.

**Fully read as of 2026-08-27.** All four content sections — Account, Plan, Notifications, Data & privacy — were checked individually. **Every one is byte-identical to the base Settings & Plan screen** (`q6okB`). Free still shows as `CURRENT`; no expiry-specific banner, warning, date, or grace-period messaging exists anywhere in the frame. No node in the entire tree matches `banner`, `notice`, `expir`, `alert`, or `warn` except the unrelated data-deletion warning text shared with the base screen.

**Conclusion: this is not a completed variant with hidden content — it's an unfinished one.** The most likely explanation is the designer duplicated the base screen as a starting point, resized the canvas taller in anticipation of adding expiry-specific content, and hasn't filled it in yet.

⚠️ **Do not build against this screen.** There's nothing here beyond what the base Settings screen already specifies. The actual "what happens when a subscription expires" question remains genuinely open — same status as before this read, just now confirmed rather than assumed.

**What still needs designing, unchanged:**
- What a user sees when their Pro subscription lapses (banner? forced downgrade notice? grace period?)
- Whether "downgrade behaviour" (F6's original open question) gets answered by a screen that doesn't yet exist, or needs to be designed from scratch

---

# 6 · WHAT THIS RESOLVES FROM F6's OPEN QUESTIONS

| Original open question (`PRODUCT-REFERENCE_quarterfinal.md` Section 3) | Status |
|---|---|
| Checkout flow design | Resolved - modal, billing cycle toggle, Razorpay-hosted redirect |
| Trial to paid transition | Partially - the Upgrade button exists on the base Settings screen; unclear if trial users see different copy |
| Failed renewal | Partially - Payment Failed state exists, but is a draft (Section 4) |
| Webhook timing / confirmation UX | Resolved - the Verifying state directly addresses this |
| Downgrade behaviour | Confirmed NOT designed - the Subscription Expiry screen intended to answer this is unfinished (Section 5) |
| Refunds | Still open - not shown in any of these five screens |
| Cancellation | Still open - Settings mentions "Cancel anytime from Settings" but no cancellation flow is drawn |
| GST invoicing | Still open |
| Annual vs monthly switching mid-cycle | Still open |

**F6 moved from "no design exists" to "checkout flow substantially designed, several states still draft or unread."** Genuine progress, not yet complete.

---

# 7 · NEW TASKS THIS SURFACES

| | Task | Depends on |
|---|---|---|
| F6-1 | `POST /api/subscription/checkout` - creates Razorpay order, returns redirect URL | Razorpay integration |
| F6-2 | Razorpay webhook handler - idempotent, signature-verified | F6-1 |
| F6-3 | `GET /api/subscription/status` - polling endpoint for the Verifying state | F6-2 |
| F6-4 | Checkout modal, billing cycle toggle, annual pre-selected | F6-1 |
| F6-5 | Verifying-payment modal state, non-dismissible | F6-3 |
| F6-6 | Payment-failed modal state - needs real copy + Retry button from designer first | Design revision |
| F0/F1-X | Data export endpoint + Settings button (Section 1) | New - not previously tracked |
| - | Retention-period decision, then wire the "TBD" chip | `DATABASE_quarterfinal.md` Section 11 |

---

# 8 · OPEN

| | Question |
|---|---|
| 1 | ~~Subscription Expiry's actual banner content~~ - **resolved: confirmed empty, not designed.** Needs the designer to actually build this screen's expiry-specific content |
| 2 | Payment Failed needs real copy and a Retry action - flag to designer |
| 3 | Settings-nav active state (2px left border) vs main-nav active state (3px accent rail) - same pattern, different values. Intentional? |
| 4 | Cancellation flow - mentioned in fine print, never drawn |
| 5 | Does a trialing user see different Settings copy than a Free (post-trial) user? |

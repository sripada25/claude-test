# SCREEN-NOTES-M06.md — Generate document

Pen source: `YW201` — "Mockup — 06 Generate document" · 1440×900 · read 2026-08-26
Screen: `Mockup___06_Generate_document.png`

**Design intent from plate `x8AtN` notes** (wireframe plate — notes only, styling ignored):

> *"Quota is always visible. Users should never discover the 5-per-month limit at the moment they hit it. Enforced server-side regardless of what this shows."*
> *"The counter is decoration; the server is the enforcement. Quota must be checked in a transaction at generation time, not read from a cached number. A bug in this check isn't a UI bug, it's a billing event."*
> *"the shared Gemini free tier caps at 1,500 requests/day across all users. Per-user quota does nothing to prevent every user failing at once on a busy day."*

⚠️ **No sidebar on this screen.** It's a focused task view — the only app screen without `M/Sidebar`.

---

# 1 · LAYOUT

```
YW201   fill $m-bg · 1440×900 · vertical      ← no sidebar
├─ uT8fO  Top bar  fill $m-surface · border-bottom 1 · h 56 · pad [0,32] · gap 10
└─ Wr9my  Body     pad [28,32] · gap 22 · vertical
   └─ faL8a Columns gap 32
      ├─ esn0x Left col   w 246 fixed · gap 14 · vertical
      └─ NUGt4 Right col  fill · gap 14 · vertical
```

⚠️ **Third top-bar height: 56px** — after M03's 68 and M05's 60. **Normalise to 64px** across all app chrome (§8 in `SCREEN-NOTES-M05.md`). A header that changes height between screens jumps visibly during navigation.

⚠️ **Body padding is `[28,32]`** vs M03/M05's `[26,28]`. Also normalise.

**Responsive:** left column stacks above the result below `lg` — it holds the controls, and controls-below-output is wrong on mobile.

---

# 2 · TOP BAR

## 2.1 · `BackLink` — `sAuhg`

```
gap 6 · align center
  icon  lucide "arrow-left" 15×15 $m-ink-2
  text  "Razorpay — Product Designer II"  body 13/500  $m-ink-2
```

⚠️ **The back link carries the application title, not "Board".** It returns to M05, and naming the destination is better than a generic label.

## 2.2 · `QuotaBadge` — `jvh6o` ⚠️ always visible

```
fill $m-accent-soft · pad [7,12] · gap 8 · align center
  text  "3 of 5 generations left this month"  body 12.5/600  $m-accent
  icon  lucide "info" 15×15 $m-muted
```

**Designer's note 1:** *"Quota is always visible. Users should never discover the 5-per-month limit at the moment they hit it."*

```jsx
<div className="flex items-center gap-2 bg-[--color-accent-soft] px-3 py-[7px]"
     role="status" aria-live="polite">
  <span className="font-body text-[12.5px] font-semibold text-[--color-accent]">
    {remaining} of {limit} generations left this month
  </span>
  <Info size={15} className="text-[--color-muted]" />
</div>
```

⚠️ **Pro users see a different string** — "Unlimited generations" or the fair-use figure (L093: 300/month). Don't render "3 of 5" to a paying user.
⚠️ **`aria-live="polite"`** so the count change after generating is announced.

### 🔴 The counter is decoration — the server is the enforcement

**Designer's note 2:** *"Quota must be checked in a transaction at generation time, not read from a cached number. A bug in this check isn't a UI bug, it's a billing event."*

This matches L092 exactly — one atomic statement at enqueue:

```sql
UPDATE generation_quota SET used = used + 1
WHERE user_id = $1 AND period_start = date_trunc('month', now()) AND used < 5
RETURNING used;
```

No row returned ⇒ refuse. **Never trust the client's number.**

---

# 3 · LEFT COLUMN — controls

## 3.1 · `DocumentTypeToggle` — `uRKT9`

```
vertical · gap 9
  SELECTED    fill $m-primary · pad [12,16] · centred · text body 13.5/600 #FFFFFF
  UNSELECTED  fill $m-surface · stroke $m-border-strong 1 · text body 13.5/600 $m-ink-2
```

⚠️ **Third selected-state pattern.** M02's location control is filled (`$m-primary`), M03's view toggle is inset, this is filled-and-stacked. **M02 and M06 share the pattern** — `SegmentedControl variant="filled"` with an `orientation` prop.

Two options: **Cover letter** · **Resume**.
**A11y** — `role="radiogroup"`, arrow keys.

## 3.2 · `InputsPanel` — `nonTB` ⚠️ readiness, not inputs

```
fill $m-surface · stroke $m-border 1 · vertical
Row  pad [12,14] · justify space-between · align center   (2nd onward: border-top 1)
  label  body 13/normal  $m-ink
  status badge
```

| Row | Label | Status |
|---|---|---|
| `JLYk9` | Your profile | ✅ `$m-success-soft` + check icon 10×10 + "Complete" mono 9.5/600 `$m-success` |
| `F0mwIx` | Job description | ✅ same — "Snapshot saved" |
| `ofmG7` | Tone | dropdown — "Standard" body 12.5/600 + chevron |

**This panel is a preflight checklist**, not a form. It tells the user whether generation can succeed *before* they spend a generation.

⚠️ **Only the success state is drawn.** The failure states matter more:

| Condition | Badge | Blocks generate? |
|---|---|---|
| Profile complete | `$m-success-soft` "Complete" | — |
| **Profile incomplete** (L098) | `$m-danger-soft` "Incomplete — complete profile" | ✅ |
| JD snapshot saved | `$m-success-soft` "Snapshot saved" | — |
| **JD empty** | `$m-warning-soft` "No job description" | ✅ |
| **Email unverified** (L040) | `$m-danger-soft` "Verify your email" | ✅ |

⚠️ **Email verification isn't a row here, but L040 gates first generation on it.** Either add a fourth row, or block at the button with an explanation.

### ⚠️ Tone — dropped from MVP (L100)

Row 3 offers Standard. **L100 removed it** — the PRD's AI generation section lists cover letter, resume, PDF download, the counter, and storage. No tone control.

**Build the row, render it disabled with "Standard", or omit it.** My recommendation: omit for MVP, keep the panel two rows. Adding it later is trivial; shipping four prompt variants is not.

## 3.3 · `GenerateButton` — `Fnb2k` → `M/Button` + helper

```
Fnb2k  REF -> zK0k4 · fill_container
lwq4p  "Takes about 5 seconds. Uses one generation."  body 11.5/normal · lh 1.5 · $m-muted
```

⚠️ **The helper text states the cost before the click** — the pattern L109 requires for Regenerate too.

```jsx
<Button variant="primary" fullWidth
        disabled={!ready || remaining === 0 || generating}
        loading={generating}
        onClick={handleGenerate}>
  {generating ? 'Generating…' : 'Generate'}
</Button>
<p className="font-body text-[11.5px] leading-[1.5] text-[--color-muted]">
  Takes about 5 seconds. Uses one generation.
</p>
```

**Flow** (L091): POST → enqueue job → poll or subscribe → render result.
⚠️ **Never block the request thread on the Gemini call.** ~5s holding a DB connection is a denial-of-service vector.
⚠️ **Quota refunded on failure** (L092, L096) — 2 attempts, no retry on 400/safety/validation.

---

# 4 · RIGHT COLUMN — result

## 4.1 · `ResultHeader` — `N9FDi`

```
justify space-between · align center
  "RESULT"  mono 10.5/600 · ls 0.8 · $m-ink-2
  Result actions  gap 8
    Regenerate  fill $m-surface-2 · pad [6,10] · gap 5 · icon "rotate-cw" 12 · text body 12/600 $m-ink-2
    Edit        fill $m-surface-2 · pad [6,10] · gap 5 · icon "pencil" 12 · text body 12/600 $m-ink-2
```

⚠️ **A fourth button treatment** — `$m-surface-2` fill, no stroke, 12px text. Neither primary nor the `$m-surface`+`$m-border-strong` secondary. **`Button variant="ghost"`.**

### 🔴 Regenerate must show its cost (L109)

Each click is a full-price Gemini call and decrements quota atomically.

```jsx
<Button variant="ghost" icon={RotateCw} disabled={remaining === 0}
        onClick={confirmRegenerate}>
  Regenerate {remaining > 0 && `(${remaining} left)`}
</Button>
```

**Consider a confirm step.** A user unhappy with output may click three times and consume their monthly quota in ten seconds.

**Edit** — makes the result editable in place, saves to `documents.content`. **No AI call, no quota.**

## 4.2 · `ResultCard` — `BZZO6`

```
fill $m-surface · stroke $m-border 1 · pad [26,28] · gap 14 · vertical
  Salutation  body 13.5/600 · $m-ink
  Paragraphs  body 13/normal · lh 1.6 · $m-ink-2 · fill
  Signoff     body 13.5/600 · lh 1.6 · $m-ink  ("Warm regards,\nAakriti Kapoor")
```

⚠️ **The signoff contains a literal `\n`** — rendered with `whitespace-pre-line`, not two nodes.

⚠️ **Salutation and signoff are heavier (600) than the body (normal).** The model's output must be parsed into these parts, or the whole thing renders uniformly.

**Practical approach:** render the whole result with `whitespace-pre-line` at body/normal and skip the weight distinction. Reliably identifying a salutation in model output is fragile, and getting it wrong looks worse than uniform text.

⚠️ **Rendered as plain text — never `dangerouslySetInnerHTML`.** This is model output derived from user-pasted JD text (the M04 prompt-injection vector). Treat it as untrusted.

**Loading state — not drawn.** ~5s needs a skeleton matching the card's shape.

## 4.3 · `DownloadRow` — `xFIOT`

```
gap 12 · justify end
  UzmdB  Download  fill $m-surface · stroke $m-border-strong 1 · pad [12,20] · gap 9
                   icon "download" 15 $m-ink-2 · text body 13.5/600 $m-ink
  qMub9  REF -> zK0k4  "Save to application"
```

⚠️ **Download is drawn enabled on a free plan.** L062 gates it to Pro.

**Per your decision (C2): show it, lock it, don't disable it.**

```jsx
<Button variant="secondary" icon={Download}
        onClick={isPro ? handleDownload : openUpgrade}>
  Download {!isPro && <Lock size={13} />}
</Button>
```

Free users can still select and copy the text — only the convenience is gated. A greyed button teaches nothing; one that looks live and refuses feels like a trick.

**Save to application** → `documents` row linked to `application_id`, writes a timeline event ("Cover letter generated"), and the `Doc` tag appears on the board card.

⚠️ **Is the document saved before or after this click?** If generation already persisted it, this button is redundant. If not, a user who navigates away loses it. **Recommendation: persist on generation, treat this as "done, return to application."**

## 4.4 · `PaywallPanel` — `wYveS`

Labelled in the file as `ALTERNATE STATE — QUOTA EXHAUSTED` — a designer annotation, not a component.

```
fill $m-accent-soft · stroke $m-accent 1 · pad [18,20] · gap 20 · justify space-between · align center
  Copy  gap 6 · vertical · fill
    Head  gap 6 · align center
      icon  lucide "lock" 14×14 $m-accent
      text  "You've used all 5 free generations this month"  body 13.5/700  $m-accent
    text  "They reset on 1 Sept. Tracking stays unlimited — this only affects new document generation."
          body 12.5/normal · lh 1.5 · $m-ink-2
  GeX1A  REF -> zK0k4 · fill $m-accent   ← "Upgrade"
```

⚠️ **The upgrade button is `$m-accent`, not `$m-primary`** — an `M/Button` with an accent override. **`Button variant="accent"`**, a fifth variant.

**The copy is genuinely good.** *"Tracking stays unlimited — this only affects new document generation"* communicates the exact free/paid boundary (L055) and prevents the user assuming the whole product stopped.

⚠️ **The reset date must be computed**, not hardcoded — first day of the next calendar month, in the user's timezone (L041).

---

# 5 · SCREEN STATES — five, one drawn

| State | Drawn? |
|---|---|
| Ready — inputs complete, quota available | ✅ |
| Generating — ~5s | ❌ skeleton needed |
| Result | ✅ |
| **Quota exhausted** | ✅ paywall |
| **Blocked** — profile incomplete / email unverified | ❌ |
| **Failed** — after 2 attempts (L096) | ❌ needs error + retry, quota refunded |

---

# 6 · OPEN

| | Question |
|---|---|
| 1 | **Tone row** — omit (L100), or render disabled? |
| 2 | Is the document persisted on generation, or only on "Save to application"? |
| 3 | Should Regenerate confirm before spending a generation? |
| 4 | Where does email verification (L040) appear — a fourth inputs row, or blocked at the button? |
| 5 | What does a Pro user see in the quota badge — "Unlimited", or the L093 fair-use figure? |
| 6 | Top bar 56 here, 60 on M05, 68 on M03 — confirm 64 everywhere |

---

# 7 · COMPONENT REUSE — final tally across six screens

| Component | Variants needed |
|---|---|
| **`Button`** | **5 variants** — primary · secondary · ghost · accent · icon-only · **3 sizes** · optional icon · loading · fullWidth |
| `Tag` | 3 sizes · default / accent / success variants · removable |
| `SegmentedControl` | filled (M02, M06) · inset (M03) · horizontal / vertical |
| `Field` | 10+ instances · optional `labelAction` slot |
| `StatusBadge` | 6 stage colours from `-soft` pairs |
| `KeyValuePanel` | M05 last-call · M06 inputs |

**`Button` appears on all six screens with five distinct treatments.** It is the single highest-leverage component in the system — build it once, completely, with every variant, before anything else.

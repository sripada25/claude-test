# FRONTEND-COMPONENTS.md

Component inventory derived from seven mockups. Each entry carries what's needed to build it without re-deriving anything.

**Strategy — why it's ordered this way:** primitives first, then composites, then screens. Building screens first produces seven variants of the same button. The inventory below was assembled by listing every distinct visual element across all mockups, then collapsing anything that appeared more than once into a primitive. **21 primitives serve 9 screens.**

**No component library** (L020). Everything is hand-built with Tailwind 4 + HTML5.

---

# 0 · DESIGN TOKENS

Extracted from the mockups. Define once in `app/globals.css` under `@theme` (Tailwind 4 is CSS-first — no JS config needed for this).

```css
@theme {
  --color-brand:        #C2410C;   /* rust — logo, links, active rail */
  --color-ink:          #1B2A3D;   /* navy — sidebar, primary buttons */
  --color-ink-hover:    #16222F;
  --color-surface:      #FFFFFF;
  --color-canvas:       #F4F2EF;   /* warm grey page background */
  --color-border:       #E3E0DC;
  --color-muted:        #6B7280;
  --color-warn-bg:      #FDEBD8;   /* quota banner */
  --color-warn-fg:      #C2410C;

  /* stage colours — mockup 04 column dots */
  --color-stage-saved:      #9CA3AF;
  --color-stage-applied:    #1B2A3D;
  --color-stage-assessment: #B45309;
  --color-stage-interview:  #7C6BB0;
  --color-stage-offer:      #15803D;
  --color-stage-rejected:   #C2410C;

  --font-sans: ui-sans-serif, system-ui, sans-serif;
  --font-mono: ui-monospace, monospace;   /* labels, chips, counters */
}
```

⚠️ **Field labels are uppercase monospace with letter-spacing** across every mockup (`EMAIL`, `SKILLS`, `JOB DESCRIPTION`). That's a deliberate signature — encode it in the `Label` primitive, not per-screen.

---

# 1 · PRIMITIVES — 21 components

Reusable across two or more screens. Build these first.

## P-01 · Button

| | |
|---|---|
| **Screens** | M2, M3, M5, M6, M7 |
| **Task** | T8.1 |
| **HTML** | `<button type="button">` — **never `<div onClick>`** |
| **Variants** | `primary` (ink bg, white text) · `secondary` (white bg, border) · `ghost` · `danger` |
| **Sizes** | `sm` `md` `lg`; `fullWidth` boolean |
| **Tailwind** | `inline-flex items-center justify-center gap-2 rounded-md font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed focus-visible:outline-2 focus-visible:outline-offset-2` |
| **React** | `loading` prop → spinner + `aria-busy`, disables click. Forward `ref`. |
| **A11y** | Never remove focus outline. Icon-only needs `aria-label`. |
| **Errors** | Parent owns error state; button only reflects `loading`/`disabled` |

## P-02 · Input

| | |
|---|---|
| **Screens** | M2, M3, M5 |
| **Task** | T8.1, T8.5 |
| **HTML** | `<input>` with a real `<label for>` — **placeholder is not a label** |
| **Tailwind** | `w-full rounded-md border px-3 py-2 text-sm placeholder:text-[--color-muted] focus:ring-2 focus:ring-[--color-ink] aria-[invalid=true]:border-red-500` |
| **React** | Controlled. `error?: string` renders below and sets `aria-invalid` + `aria-describedby` |
| **Errors** | Validate on blur, not per keystroke. Clear on correction. |

## P-03 · Label
Uppercase mono, `text-xs tracking-wider text-[--color-muted]`. Optional `(OPTIONAL)` suffix — see mockup 03's `BASE RESUME (OPTIONAL)`.

## P-04 · Select
`<select>` — native, not a custom listbox. Free keyboard and mobile behaviour. Used for status, experience years/months, currency, sort.

## P-05 · Chip / Tag
Skills (M3), card badges (M4). `removable` renders an `<button aria-label="Remove {x}">`, not a bare `×`.

## P-06 · TagInput
**Composite of P-02 + P-05.** Enter or comma commits; Backspace on empty removes last. **Lowercase-normalise on commit** (L045). Dedupe silently.

## P-07 · SegmentedControl
Location preference (M3), Board/List (M4). `role="radiogroup"` with arrow-key navigation — not three buttons.

## P-08 · Card
White surface, `rounded-lg border shadow-sm`. Application cards add a **2px top border in the stage colour** (mockup 04).

## P-09 · Badge / StatusPill
`Status: Interview` (M6), `Free plan` (M1). Colour from stage token.

## P-10 · Banner
Quota exhausted (M7), announcement (F0). `role="status"`; dismissible variant needs a labelled close button.

## P-11 · Drawer / SlideOver
Add application (M5). **Focus trap, Escape to close, `aria-modal`, return focus to trigger.** Body scroll lock. Backdrop click closes only if the form is clean — otherwise confirm.

## P-12 · Tabs
Detail screen (M6). `role="tablist"`, arrow keys, `aria-selected`. Count suffix — `Documents 2`.

## P-13 · Textarea + CharCounter
JD input (M5), notes (M6). Counter shows `3,214 / 15,000` (L103). **Warn at 90%, hard-block at 100%** — server enforces independently.

## P-14 · FileDropzone
Resume upload (M3). `<input type="file" accept="application/pdf">` + drag events. **Magic-byte check happens server-side** (G10) — client validation is UX only.

## P-15 · Spinner
`role="status"` + visually-hidden "Loading".

## P-16 · EmptyState
"Nothing here yet" (M4). Icon + line + optional action.

## P-17 · Avatar
Initials from name. **No image** — L082 takes the Google name claim only.

## P-18 · IconButton
Close, overflow `⋯`. Always `aria-label`.

## P-19 · Divider
`<hr>` or a labelled "or" separator (M2).

## P-20 · Timeline
Detail screen (M6). `<ol>` — it's an ordered list of events, semantically.

## P-21 · KeyValueList
"From the last call" (M6). `<dl>` / `<dt>` / `<dd>`.

---

# 2 · COMPOSITES — 12 components

## C-01 · AuthCard
**Screens** M2 · **Task** T8.1 · **API** `POST /api/auth/login`, `/signup`
Heading swaps between "Sign in to your account" and "Create an account" — **same component, same route**.
⚠️ **Errors must be identical for unknown-email and wrong-password** (SECURITY §6, test #2). Never render a server error verbatim.

## C-02 · SSOButtonGroup
**Screens** M2 · **Task** T8.2 · **API** `GET /api/oauth/google/start`
Google active. **LinkedIn visible but disabled** with a tooltip (L074, C4). Provider-error return renders in the parent's error slot.

## C-03 · OtpInput
**Screens** M2 (inline) · **Task** T8.3 · **API** `POST /api/auth/verify`
Six single-character fields. Paste distributes across all six. Auto-advance, Backspace retreats.
⚠️ **Expired and incorrect must read differently** (L071): *"Code expired — send a new one"* vs *"Incorrect code — 3 attempts remaining"*. Resend has a visible cooldown.

## C-04 · ForgotPasswordForm
**Screens** M2 (replaces the sign-in body) · **Task** T3.7
**Always the same response** regardless of whether the account exists (G6). Then OTP → set new password. **No temporary password by email** (L099).

## C-05 · ProfileForm
**Screens** M3 · **Task** T8.5 · **API** `GET`/`PUT /api/profile`
Fields: full name, current role (L101), **years + months** (L107), target role, skills (P-06), salary (amount + currency + period), location (P-07, L102).
Dirty-state warning on navigate away. **"Skip for now" built and hidden** (L098).

## C-06 · ResumeUploadReview
**Screens** M3 · **Task** T8.4 · **API** `POST /api/profile/parse-resume`
Upload → parse → **fields populate and stay editable**. This *is* the review step (L049) — the safeguard is that extracted values are visibly editable, not a separate confirmation screen.
Loading: "Reading your resume…" ~5s. Failure: form stays usable for manual entry, never blocks.

## C-07 · ApplicationCard
**Screens** M4 · **Task** F2-3.4
Company, role, age badge (`2d`), tag chips (`Follow up`, `Call log`, `Doc`). Top border in stage colour.
Whole card is a link — but if drag-and-drop ships (F2-3.6), the drag handle must not swallow the click.

## C-08 · PipelineBoard
**Screens** M4 · **Task** F2-3.3 · **API** `GET /api/applications`
Six columns, "Rejected" as a collapsed right rail. Horizontal scroll on narrow screens.
🔵 Drag-and-drop is **optional** (F2-3.6). If included: optimistic move, rollback + toast on failure, and a keyboard path (F2-3.7).

## C-09 · FilterBar
**Screens** M4 · **Task** F2-3.11 – F2-3.14
Search (debounced 300ms), Status, Source, Sort, Board/List toggle.
**Source filter empty state:** prompt the user to add sources rather than showing an empty dropdown (L110).

## C-10 · AddApplicationDrawer
**Screens** M5 · **Task** F2-3.15 · **API** `POST /api/applications`
P-11 + form. JD textarea with counter (P-13) and the snapshot note.
⚠️ **"Generate after saving" checkbox shows the remaining count** — *"(3 of 5 left)"* — and is **disabled at zero** with an upgrade link (L092, N4.4).
Save returns **immediately**; generation is queued (L091). Never block the drawer on a 5-second API call.

## C-11 · ApplicationDetail
**Screens** M6 · **Task** F2-3.18 – F2-3.20
Tabs (P-12): Overview live; **Documents / Call log / Reminders are empty shells** filled by F3/F5/F4.
Right panel: actions + "From the last call" (P-21) — populated by F5, empty until then.

## C-12 · GenerationPanel
**Screens** M7 · **Task** F3 · **API** F3 endpoints
Type toggle, input readiness checklist, Generate, result, Download.
⚠️ **Download shows `🔒 Pro` for free users** and opens the upgrade prompt (C2, L062) — present and visibly gated, not greyed out.
⚠️ **Regenerate decrements quota** and says so (L109).
Quota-exhausted banner (P-10) with the "tracking stays unlimited" copy.

---

# 3 · SCREEN → COMPONENT MATRIX

| | M1 Sidebar | M2 Auth | M3 Profile | M4 Board | M5 Add | M6 Detail | M7 Generate |
|---|:--:|:--:|:--:|:--:|:--:|:--:|:--:|
| P-01 Button | | ● | ● | ● | ● | ● | ● |
| P-02 Input | | ● | ● | ● | ● | | |
| P-03 Label | | ● | ● | | ● | ● | ● |
| P-04 Select | | | ● | ● | ● | ● | ● |
| P-05 Chip | ● | | ● | ● | | ● | |
| P-06 TagInput | | | ● | | | | |
| P-07 Segmented | | | ● | ● | | | ● |
| P-08 Card | | ● | ● | ● | | ● | ● |
| P-09 Badge | ● | | | ● | | ● | ● |
| P-10 Banner | | | | | | | ● |
| P-11 Drawer | | | | | ● | | |
| P-12 Tabs | | | | | | ● | |
| P-13 Textarea | | | | | ● | ● | |
| P-14 Dropzone | | | ● | | | | |
| P-15 Spinner | | ● | ● | ● | ● | ● | ● |
| P-16 EmptyState | | | | ● | | ● | |
| P-17 Avatar | ● | | | | | | |
| P-18 IconButton | | | | | ● | ● | |
| P-19 Divider | ● | ● | ● | | | ● | |
| P-20 Timeline | | | | | | ● | |
| P-21 KeyValue | | | | | | ● | |

**P-01, P-15 and P-19 appear on nearly every screen** — build them first and build them properly.

---

# 4 · UNIVERSAL RULES

## Loading

Three distinct states, never conflated:

| State | Treatment |
|---|---|
| Initial load | Skeleton matching final layout — prevents layout shift |
| Action in flight | Button spinner + `aria-busy`, form disabled |
| Background (generation) | Non-blocking pending badge; user keeps working |

**Generation never blocks the UI** (L091). The job is queued; the screen shows pending.

## Errors

| Kind | Treatment |
|---|---|
| Field validation | Inline, below the field, `aria-describedby` |
| Form submission | Summary at the top of the form, focus moved to it |
| Network failure | Toast with retry |
| Auth failure | **Generic, identical for all causes** (G6) |
| Job failure | Detail screen shows failed + retry. **Quota refunded** (L092) |

**Never render a server error message verbatim.** Map to a known set client-side (`DATABASE-SECURITY.md` §7).

## Security

- **Route guards are UX only.** Every endpoint enforces auth server-side independently
- **No `localStorage`** for tokens — the session cookie is httpOnly by design
- **No `dangerouslySetInnerHTML`** on user content
- CSRF token on every state-changing request (T7.2)
- External links (`source_url`) get `rel="noopener noreferrer"` (L110)

## Accessibility

Every interactive element reachable by keyboard · visible focus, never `outline: none` · `<label for>` on every input · `role="status"` on async regions · colour never the sole signal — stage dots pair with text.

---

# 5 · BUILD ORDER

1. **Tokens** — `@theme` block
2. **P-01, P-02, P-03, P-15, P-19** — used everywhere
3. **P-04 – P-10** — form and display primitives
4. **P-11 – P-21** — specialised
5. **C-01 – C-06** — auth and profile (F1)
6. **C-07 – C-11** — tracker (F2)
7. **C-12** — generation (F3)

Steps 1–4 are **21 components with no API dependency at all**. They can be built and tested in isolation before a single endpoint exists.

---

# 6 · OPEN

| | Question |
|---|---|
| Q1 | **Drag-and-drop on the board** — in or out? Affects C-08, F2-3.6 – F2-3.8 |
| Q2 | Are token hex values above close enough? Sampled from the mockups by eye — your designer has exact values |
| Q3 | Toast/notification system — needed, or inline errors only? Not in any mockup |
| Q4 | Mobile breakpoints — mockups are desktop only. Does MVP web need responsive, or is that the mobile app's job? |

**Q4 matters more than it looks.** "Web first, mobile later" (L020) could mean desktop-only web, or responsive web. It roughly doubles the CSS work on the board and drawer.

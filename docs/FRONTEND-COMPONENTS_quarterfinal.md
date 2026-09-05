# FRONTEND-COMPONENTS_quarterfinal.md — Trackr

Complete component inventory. **Every visual value read from `untitled.pen`**, not estimated.

Supersedes `FRONTEND-COMPONENTS.md`, where §0's tokens were sampled by eye and were wrong on nearly every value — including all three typefaces. That file remains unchanged.

**Companion documents:** `DESIGN-SYSTEM.md` (tokens) · `INTERACTION-STATES.md` (states) · `SCREEN-NOTES-M01…M06.md` (per-screen) · `BOARD-COMPONENT.md` (drag)

---

# 0 · TWO CLASSES OF PROPERTY

Every value below is labelled, because they change for different reasons:

| | Meaning | Changes when |
|---|---|---|
| 🎨 **DESIGN** | Read from `untitled.pen` | The designer changes the file |
| 🔧 **DECISION** | From our discussions and the ledger | A ledger entry is revisited |

A mockup contains visual values, **not component architecture**. `M/Field` is a visual pattern; `Field` is an engineering component with validation timing, error rendering, and `aria-invalid`. The designer's component list is evidence of visual reuse, not a specification.

---

# 1 · PERFORMANCE — read this before the inventory

**"Can this component handle 100 concurrent users?" doesn't apply to components.**

A React button renders in each person's browser. It behaves identically for 1 user or 100 — they never compete. **Concurrency lives in the endpoint the component calls.**

Two things genuinely matter client-side:

**Frame budget (16.7ms at 60fps).** Exceed it and the frame drops. This happens to a single user, alone, with your server off. Relevant only to the board's drag (`BOARD-COMPONENT.md` §1).

**Bundle size.** Every component ships to every user. No component library (L020) is the main lever; `lucide-react` tree-shakes per icon.

Where a component's performance note is meaningful, it names **the endpoint**, not the render.

---

# 2 · TOKENS

Defined once in `app/globals.css`. Full set and provenance in `DESIGN-SYSTEM.md` §2.1.

```css
@theme {
  --color-bg: #F5F3EF;              --color-surface: #FFFFFF;
  --color-surface-2: #EFEBE3;       --color-border: #DBD5C9;
  --color-border-strong: #C2BAA9;

  --color-ink: #1B1B18;             --color-ink-2: #54524A;
  --color-muted: #8B8778;

  --color-primary: #16324F;         --color-primary-hover: #0F2439;
  --color-primary-soft: #E4EAEE;    --color-primary-foreground: #FFFFFF;

  --color-accent: #C6602C;          --color-accent-hover: #A54E23;
  --color-accent-soft: #F5E1D2;     --color-accent-foreground: #FFFFFF;

  --color-success: #1F7A4D;  --color-success-soft: #DEEDE2;
  --color-warning: #A6740F;  --color-warning-soft: #F2E7CE;
  --color-danger:  #AE3B2C;  --color-danger-soft:  #F1DFD9;
  --color-violet:  #5B4B8F;  --color-violet-soft:  #E5E1F1;

  --color-sidebar: #132638;         --color-sidebar-2: #1C3A54;
  --color-sidebar-ink: #C7D3DC;     --color-sidebar-muted: #7E93A3;

  --font-display: "Archivo", sans-serif;
  --font-body: "IBM Plex Sans", sans-serif;
  --font-mono: "IBM Plex Mono", monospace;
}
```

🎨 **No `cornerRadius` on any node in the file. Square corners throughout — never `rounded-*`.**
🎨 **No shadows.** Elevation is border-only.
🎨 **Icons: Lucide** (`lucide-react`) — every icon node carries `library: "lucide"`.
🔧 **Fonts self-hosted via `next/font`** — no external request, no layout shift.

⚠️ **Tailwind cannot see dynamically-built class names.** Stage colours need a static map, not template interpolation, or they're purged from the build.

```typescript
const STAGE = {
  saved:      { dot: 'bg-[--color-muted]',   chip: 'bg-[--color-surface-2] text-[--color-ink-2]' },
  applied:    { dot: 'bg-[--color-primary]', chip: 'bg-[--color-primary-soft] text-[--color-primary]' },
  assessment: { dot: 'bg-[--color-warning]', chip: 'bg-[--color-warning-soft] text-[--color-warning]' },
  interview:  { dot: 'bg-[--color-violet]',  chip: 'bg-[--color-violet-soft] text-[--color-violet]' },
  offer:      { dot: 'bg-[--color-success]', chip: 'bg-[--color-success-soft] text-[--color-success]' },
  rejected:   { dot: 'bg-[--color-danger]',  chip: 'bg-[--color-danger-soft] text-[--color-danger]' },
} as const;
```

---

# 3 · PRIMITIVES — 21

## P-01 · Button ⭐ highest leverage

**All six screens. Five variants, three sizes.** Build completely before anything else.

🎨 **Variants — every one read from source:**

| Variant | Fill | Stroke | Text | Seen |
|---|---|---|---|---|
| `primary` | `$m-primary` | — | `#FFFFFF` 600 | all |
| `secondary` | `$m-surface` | `$m-border-strong` 1 | `$m-ink` 600 | M01 SSO · M02 Back · M04 Cancel · M05 actions |
| `ghost` | `$m-surface-2` | — | `$m-ink-2` 600 | M06 Regenerate, Edit |
| `accent` | `$m-accent` | — | `#FFFFFF` 600 | M06 Upgrade |
| `icon` | transparent | — | `$m-ink-2` | M04 close · M05 overflow |

🎨 **Sizes:** `sm` `[10,18]` (M03 Add) · `md` `[11,16]` (M05 actions) · `lg` `[13,22]` (M/Button base)
🎨 **Label:** body · 13.5px · weight 600 · `letterSpacing 0.1`. Ghost is 12px.
🎨 **Icon:** lucide, 16×16 in `lg`, 15×15 in `md`, 12×12 in ghost. **Disabled by default in `M/Button`** — optional prop.

🔧 **Props:** `variant · size · icon · iconPosition · loading · disabled · fullWidth · type`

```jsx
<button type={type} disabled={disabled || loading} aria-busy={loading}
        className={cn(
          'inline-flex items-center justify-center gap-2 font-body font-semibold',
          'transition-colors duration-150 motion-reduce:transition-none',
          'focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[--color-accent]',
          'disabled:bg-[--color-surface-2] disabled:text-[--color-muted] disabled:cursor-not-allowed',
          VARIANT[variant], SIZE[size], fullWidth && 'w-full',
        )}>
  {loading ? <Spinner size={16} /> : icon && <Icon size={iconSize} />}
  {children}

</button>
```

🔧 **HTML:** `<button>`, never `<div onClick>`.
🔧 **A11y:** never remove the focus outline. Icon-only requires `aria-label`. Inside a form, `type="submit"` so Enter works.
🔧 **Loading disables the button** — a double-clicked login creates two sessions; a double-clicked generate consumes two quota units.
🔧 **Touch:** ⚠️ ghost at `[6,10]` is ~28px tall — **under the 44×44 minimum.** Increase padding below `md`.
🔧 **Performance:** none. The endpoint owns it.

## P-02 · Field (label + input) ⭐ most reused

🎨 `M/Field` (`scDqq`) — **10+ instances across M01, M02, M04.**

```
vertical · gap 7
Label  mono · 10.5px · 600 · letterSpacing 0.8 · UPPERCASE · $m-ink-2
Box    fill $m-surface · stroke $m-border 1 · padding [11,13]
Value  body · 13.5px · normal · $m-ink   (placeholder $m-muted)
```

🎨 **The uppercase mono label with `letterSpacing 0.8` is a verified component property**, not styling inferred from the PNGs.

🔧 **`labelAction` slot** — an optional right-aligned element in the label row. Required by M01's "Forgot password?" and M04's character counter. **One component, three uses** — do not fork it.

🔧 **Validation timing:** no validation while typing · validate on blur · validate all on submit · **clear a field's error immediately when the user resumes typing**.
🔧 **A11y:** real `<label for>`. Placeholder is not a label. `aria-invalid` + `aria-describedby` on error.
⚠️ 🔧 **Auth errors never attach to a field** — "unknown email" under the email input is enumeration through the UI (`SECURITY_quarterfinal.md` §8).

## P-03 · Label

🎨 mono · 10.5px · 600 · `letterSpacing 0.8` · uppercase · `$m-ink-2`
🎨 Optional `(OPTIONAL)` suffix in `$m-muted` — M02's "BASE RESUME (OPTIONAL)"
🔧 Always paired with a control via `htmlFor`.

## P-04 · Select

🎨 Same box as P-02. Chevron `chevron-down` 13×13 `$m-muted`.
🔧 **Native `<select>`**, not a custom listbox — free keyboard and mobile behaviour.
🔧 Used for: status · experience years/months · currency · sort.

## P-05 · Tag / Chip

🎨 **Three sizes across screens:**

| Size | Padding | Type | Seen |
|---|---|---|---|
| `xs` | `[3,7]` | mono 9.5/600 | M03 card tags |
| `sm` | `[5,10]` | mono 10.5/600 | `M/Tag` · M05 meta |
| — | `[5,10]` + gap 6 | mono 10.5/600 | M02 skill chips |

🎨 **Variants:** `default` `$m-surface-2` · `accent` `$m-accent-soft`/`$m-accent` (M03 Follow up) · `success` `$m-success-soft`/`$m-success` (M06 Complete) · `primary-soft` (M02 STEP 2 OF 2)
🎨 **`removable`** adds a lucide `x` 11×11 `$m-muted`.

🔧 **A11y:** remove control is `<button aria-label="Remove Figma">`, never a bare icon. Container `role="list"`, chips `role="listitem"`.

## P-06 · TagInput

🎨 M02 skills — box `padding [10,12]` gap 8 horizontal, chips wrap.
🔧 Enter or comma commits · Backspace on empty removes last · **lowercase-normalise on commit** (L045) · dedupe silently.
🔧 **DB:** `profiles.skills TEXT[]`

## P-07 · SegmentedControl

🎨 **Two variants, both from source:**

| Variant | Selected | Unselected | Seen |
|---|---|---|---|
| `filled` | `$m-primary` fill, white text | `$m-surface` + `$m-border-strong` | M02 location · M06 doc type |
| `inset` | `$m-surface` + `$m-border` on `$m-bg` track | no fill, `$m-muted` | M03 Board/List |

🔧 `orientation` prop — M06's doc type is vertical.
🔧 **A11y:** `role="radiogroup"` with arrow-key navigation. Three buttons is not equivalent.

## P-08 · Card
🎨 `$m-surface` · `$m-border` 1 · **no radius, no shadow.**

## P-09 · StatusBadge
🎨 M05 — `$m-{stage}-soft` fill, `$m-{stage}` stroke and text, `[8,12]`, body 12.5/600 + chevron.
🔧 Static map (§2). Interactive on M05 — opens the stage dropdown.

## P-10 · Banner
🎨 M06 paywall — `$m-accent-soft` fill, `$m-accent` stroke, `[18,20]`, lucide `lock` 14.
🔧 `role="status"`. Dismissible variant needs a labelled close.

## P-11 · Drawer
🎨 M04 — 410px, `$m-surface`, `stroke $m-border {left:1}`. ⚠️ **No backdrop element** — the board itself is `opacity 0.45`.
🔧 **Focus trap · Escape · `role="dialog"` `aria-modal` · body scroll lock · return focus to trigger.**
🔧 **Dirty-state confirm before closing** — a half-typed JD lost to a misclick is this screen's worst failure.
🔧 **Click-outside closes** (your decision) — requires adding a real backdrop.
🔧 **Responsive:** full-screen below `md`.

## P-12 · Tabs
🎨 M05 — selected: `border-bottom $m-primary 2` + body 13/600 `$m-ink`. Unselected: 13/500 `$m-muted`. Padding `[10,16]`.
🎨 **Counts are part of the label** — "Documents 2", not a badge.
🔧 `role="tablist"` · arrow keys · `aria-selected` · `aria-controls`.
🔧 **Tab state in the URL** (`?tab=documents`) so it's linkable and survives refresh.

## P-13 · Textarea + CharCounter
🎨 M04 — box `[11,13]`, height 118, body 12.5 `lineHeight 1.5`. Counter mono 11 `$m-muted`.
🔧 `aria-live="polite"` · turns `$m-danger` past 90% · `maxLength` client-side.
⚠️ 🔧 **The DB `CHECK (length ≤ 15000)` is authoritative** (L103).

## P-14 · FileDropzone
🎨 M02 — ⚠️ **fill `$m-bg`, not `$m-surface`** (inset against the card) · `stroke $m-border-strong` · height 76 · lucide `upload` 16.
🔧 **Copy must read "Drag a PDF here"** — we support PDF only (L061), the mockup says "PDF or DOC".
🔧 **Client validation is UX only.** Magic bytes checked server-side (`SECURITY_quarterfinal.md` §11).
🔧 **Endpoint performance:** ~5s Gemini vision. One call per user, ever. Queue rate limits apply.

## P-15 · Spinner
🔧 `role="status"` + visually-hidden "Loading". `motion-reduce:animate-none`.

## P-16 · EmptyState
🎨 M03 — `$m-bg` fill, `$m-border` stroke, height 56, body 12 `$m-muted`.
⚠️ 🎨 **Empty columns hold their place** — designer's note: *"the stage sequence is information even when a stage is empty."*

## P-17 · Avatar
🎨 `M/Avatar` (`VGVkz`) — 34×34 base, **32×32 in the sidebar**, `$m-accent` fill, initials **display** 12.5/700 (**11.5 in the sidebar**), white.
🔧 **Initials only, no image** (L082).

## P-18 · IconButton
🎨 M04 close `x` 18 · M05 overflow `ellipsis` 19.
🔧 Always `aria-label`. ⚠️ **Minimum 44×44 touch target** — pad beyond the icon.

## P-19 · Divider
🎨 `$m-border` 1px. Labelled "or" variant on M01 — gap 12, mono 11 `$m-muted`.
🔧 `aria-hidden` when decorative.

## P-20 · Timeline
🎨 M05 — rows `[13,16]` gap 12, icon box `$m-surface-2` 26×26, icon 14, text body 13, date mono 11.5.
🎨 **Status-change icons take the stage colour**; other events are `$m-primary`.
🔧 **`<ol>`** — semantically ordered.
🔧 **Debounce status events 2s** — fidgety drags otherwise produce five entries.

## P-21 · KeyValuePanel
🎨 M05 last-call · M06 inputs — rows `[12,14]`, `border-top` from the second, key body 12 `$m-muted`, value body 13/600 `$m-ink`.
🔧 **`<dl>` / `<dt>` / `<dd>`.**

---

# 4 · COMPOSITES — 12

| | Screen | Task | Endpoint | Notes |
|---|---|---|---|---|
| **C-01 AuthCard** | M01 | T8.1 | `POST /auth/login`, `/signup` | 🔧 Heading swaps signin/signup — **same route**. ⚠️ Identical error for unknown-email and wrong-password |
| **C-02 SSOButtonGroup** | M01 | T8.2 | `GET /oauth/google/start` | 🎨 **Not `M/Button`** — `$m-surface` + `$m-border-strong`. Brand marks hardcoded `#1A73E8` / `#0A66C2`. 🔧 **LinkedIn visible but disabled** (L074). Full navigate, not `fetch` |
| **C-03 OtpInput** | M01 inline | T8.3 | `POST /auth/verify` | 🔧 Six fields, paste distributes. ⚠️ **"Expired — resend" vs "Incorrect — 3 left" must differ** (L071) |
| **C-04 ForgotPasswordForm** | M01 inline | T3.7 | `POST /auth/forgot-password` | 🔧 **Always the same response** regardless of account existence. **No temporary password by email** (L099) |
| **C-05 ProfileForm** | M02 | T8.5 | `GET`/`PUT /profile` | 🔧 **Experience = years + months** (L107), diverging from the mockup's single field. Dirty-state warning |
| **C-06 ResumeUploadReview** | M02 | T8.4 | `POST /profile/parse-resume` | 🔧 Fields populate and **stay editable** — this *is* the review step (L049) |
| **C-07 ApplicationCard** | M03 | F2-3.4 | — | 🎨 **Stroke `{right,bottom,left}` — no top.** The 3px stage bar is a **child element** |
| **C-08 PipelineBoard** | M03 | F2-3.3 | `GET /applications` | 🔧 `@dnd-kit`, `activationConstraint: {distance: 8}`. ⚠️ **Filter `deleted_at IS NULL`** |
| **C-09 FilterBar** | M03 | F2-3.11–14 | `GET /applications` | 🎨 Chip label carries the value — "Sort: Recent" |
| **C-10 AddApplicationDrawer** | M04 | F2-3.15 | `POST /applications` | 🔧 **Save returns immediately**; generation queued (L091) |
| **C-11 ApplicationDetail** | M05 | F2-3.18–20 | `GET /applications/:id` | 🔧 Documents / Call log / Reminders are **empty shells** until F3/F5/F4 |
| **C-12 GenerationPanel** | M06 | F3 | F3 endpoints | 🔧 **Download shows `🔒 Pro`** for free users (L062). **Regenerate decrements quota** (L109) |

---

# 5 · SCREEN → COMPONENT MATRIX

| | Sidebar | M01 | M02 | M03 | M04 | M05 | M06 |
|---|:--:|:--:|:--:|:--:|:--:|:--:|:--:|
| P-01 Button | | ● | ● | ● | ● | ● | ● |
| P-02 Field | | ● | ● | ● | ● | | |
| P-03 Label | | ● | ● | | ● | ● | ● |
| P-04 Select | | | ● | ● | ● | ● | ● |
| P-05 Tag | ● | | ● | ● | | ● | ● |
| P-06 TagInput | | | ● | | | | |
| P-07 Segmented | | | ● | ● | | | ● |
| P-08 Card | | ● | ● | ● | | ● | ● |
| P-09 StatusBadge | ● | | | ● | | ● | |
| P-10 Banner | | | | | | | ● |
| P-11 Drawer | | | | | ● | | |
| P-12 Tabs | | | | | | ● | |
| P-13 Textarea | | | | | ● | ● | |
| P-14 Dropzone | | | ● | | | | |
| P-15 Spinner | | ● | ● | ● | ● | ● | ● |
| P-16 EmptyState | | | | ● | | ● | ● |
| P-17 Avatar | ● | | | | | | |
| P-18 IconButton | | | | | ● | ● | |
| P-19 Divider | ● | ● | ● | | | ● | |
| P-20 Timeline | | | | | | ● | |
| P-21 KeyValue | | | | | | ● | ● |

**P-01, P-15 and P-19 appear nearly everywhere.** Build them first, properly.

---

# 6 · UNIVERSAL RULES

## Loading

| State | Treatment |
|---|---|
| Initial | **Skeleton matching final layout** — prevents layout shift |
| Action in flight | Button spinner + `aria-busy`, form disabled |
| Background (generation) | Non-blocking pending badge; user keeps working (L091) |

## Errors

| Kind | Treatment |
|---|---|
| Field | Inline below, `aria-describedby` |
| Form | Summary at top, **focus moved to it** |
| Network | Toast + retry |
| Auth | ⚠️ **Generic, identical for all causes** |
| Job | Detail shows failed + retry. **Quota refunded** (L092) |

🔧 **Never render a server error verbatim.** Map to a known client-side set.

🔧 **Copy tone** (`AI-RULES.md` §8.3): describe the state, name the path forward, **never assign fault**. *"All 5 generations used — they reset on 1 Sept"* not *"You've used all 5."*

## Security

- 🔧 **Route guards are UX only.** Every endpoint enforces auth server-side independently
- 🔧 **No `localStorage`** for tokens — the session cookie is httpOnly by design
- 🔧 **No `dangerouslySetInnerHTML`** on user content or model output
- 🔧 CSRF token on every state-changing request
- 🔧 External links get `rel="noopener noreferrer"` + scheme allow-list (L110)

## Accessibility

Keyboard-reachable · visible focus, never `outline: none` · `<label for>` on every input · `role="status"` on async regions · **colour never the sole signal** — stage dots pair with text · **44×44 minimum touch targets**.

## Responsive — standing requirement

| | Behaviour |
|---|---|
| App chrome | **64px everywhere** 🔧 (normalised from 🎨 56/60/68) |
| Sidebar | 232px fixed ≥ `lg`; **drawer below** |
| Two-column | Stack below `lg`. **Action column above content on mobile** |
| Board | Horizontal scroll at every size. ⚠️ **Never shrink cards below readable width** 🎨 |
| Drawer | 410px ≥ `md`; full-screen below |
| Touch targets | ⚠️ Ghost buttons and IconButtons need padding below `md` |

---

# 7 · BUILD ORDER

| | What | API needed? |
|---|---|---|
| 1 | Tokens — `@theme`, fonts via `next/font` | ❌ |
| 2 | **P-01 Button** — all 5 variants, 3 sizes, complete | ❌ |
| 3 | P-02 Field · P-03 Label · P-15 Spinner · P-19 Divider | ❌ |
| 4 | P-04 – P-10 | ❌ |
| 5 | P-11 – P-21 | ❌ |
| 6 | C-01 – C-06 — auth and profile | ✅ F1 |
| 7 | C-07 – C-11 — tracker | ✅ F2 |
| 8 | C-12 — generation | ✅ F3 |

**Steps 1–5 are 21 components with no API dependency.** Buildable and testable in isolation before a single endpoint exists.

---

# 8 · OPEN — designer

| | Question | Blocks |
|---|---|---|
| 1 | ~~Focus state~~ — **verified 2026-08-27:** `$m-accent` inner ring (buttons), `$m-primary` inner ring (fields/checkboxes), `ring-inset` not outline. Sidebar nav-item focus remains unverified — see `INTERACTION-STATES.md` §1 | ✅ mostly closed |
| 2 | ~~Disabled state~~ — **verified:** `bg-[--color-surface-2] text-[--color-muted]`, a colour change, not opacity | ✅ closed |
| 3 | ~~Error state~~ — **verified:** border `1.5px $m-danger` + a separate icon+message row below (`circle-alert` 12px + mono 10.5px) | ✅ closed |
| 4 | **Confirm square corners** — **verified:** 253 nodes checked across three screens, 0 with `cornerRadius` | ✅ closed |
| 5 | Hover on surfaces — only `$m-primary-hover` and `$m-accent-hover` exist | buttons, cards |
| 6 | **Top bar 56/60/68** across three screens — normalising to 64 | app chrome |
| 7 | Card tags are semantically overloaded — `2d`, `Doc`, `Due Fri`, `Tue 3pm` render identically | M03 |
| 8 | M06 result styles salutation/signoff at 600 — requires parsing model output, which is fragile | M06 |

**None block implementation.** All are one-line changes if he disagrees.

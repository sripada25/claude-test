# INTERACTION-STATES.md — Trackr

The states a static mockup structurally cannot contain: focus, hover, disabled, error, loading, active.

**Not designer omissions.** A PNG has no hover. These are engineering decisions, derived from the tokens that *do* exist in `untitled.pen` plus WCAG 2.2 and Tailwind conventions.

Every colour below is an existing token from `DESIGN-SYSTEM.md` §2.1 — nothing invented.

---

# 0 · CONFIRMED FROM SOURCE

| | |
|---|---|
| **Corner radius** | **0 — square.** No `cornerRadius` on any node; the pen format omits defaults, and the default is 0. **Never use `rounded-*`.** |
| **Shadows** | None on any component. Elevation is border-only. |
| **Icons** | Lucide (`lucide-react`) |
| **Fonts** | Archivo (display) · IBM Plex Sans (body) · IBM Plex Mono (labels) |

---

# 1 · FOCUS — VERIFIED FROM SOURCE

⚠️ **Section 1 below is superseded.** The proposals it contains (`outline-2 outline-offset-2`) do not match the design file. Real values, read 2026-08-27 from `M/Button — Focus`, `M/Field — Focus`, `M/Checkbox — Focus`:

**Inner stroke, not an outline.** `strokeAlignment: "inner"`, 2px, sitting flush against the component's edge rather than offset outside it.

**Color splits by component type — not by surface:**

| Component | Focus stroke |
|---|---|
| Button | `$m-accent` #C6602C |
| Field | `$m-primary` #16324F |
| Checkbox | `$m-primary` #16324F |

```css
/* Button */
focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[--color-accent]

/* Field, Checkbox */
focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[--color-primary]
```

**`ring` with `ring-inset`, not `outline`** — Tailwind's outline utility can't express an inner stroke; `ring-inset` produces the box-shadow-based inner ring that matches the pen value.

⚠️ **Sidebar nav items are not among these three components** — they have no defined focus state in the file. The `$m-accent` reasoning I'd applied there (primary fails contrast on the dark sidebar) still holds as a proposal, since nothing here contradicts it — but it remains unverified, unlike buttons/fields/checkboxes above which are now confirmed.

**Never animate focus** — `duration-0` still applies; this wasn't touched by the correction.

---

# 1b · FOCUS — original proposal (superseded, kept for reference)

## The rule

```css
focus-visible:outline-2
focus-visible:outline-offset-2
focus-visible:outline-[--color-primary]
```

**`focus-visible`, not `focus`** — it shows the ring for keyboard users and suppresses it for mouse clicks. Exactly the behaviour you want, and it's why the old "remove the ugly outline" habit is obsolete.

## Per element

| Element | Treatment | Why |
|---|---|---|
| Buttons (primary, SSO) | `outline-2 outline-offset-2 outline-[--color-primary]` | Offset keeps it clear of the fill |
| Inputs, textarea | `outline-2 outline-offset-0 outline-[--color-primary]` **and** `border-[--color-primary]` | **No offset** — an offset ring on a bordered box reads as a double border |
| Links (Forgot password, Create account) | `outline-2 outline-offset-2 outline-[--color-accent]` | Accent matches the link colour |
| Cards, nav items | `outline-2 outline-offset-[-2px] outline-[--color-accent]` | Inset — an outer ring would collide with neighbours |
| Checkbox | `outline-2 outline-offset-2 outline-[--color-primary]` | |

## Contrast check

`--color-primary #16324F` against `--color-surface #FFFFFF` ≈ **12:1**. Well past the 3:1 minimum.
Against the sidebar `#132638` it would fail — so **inside the sidebar, focus uses `--color-accent` (#C6602C)** instead.

---

# 2 · HOVER

The file provides exactly two hover tokens: `--color-primary-hover` and `--color-accent-hover`. Everything else is derived from existing tokens.

| Element | Rest | Hover |
|---|---|---|
| Primary button | `bg-primary` | `bg-primary-hover` (#0F2439) |
| SSO button | `bg-surface` | `bg-surface-2` (#EFEBE3) |
| Link / accent text | `text-accent` | `text-accent-hover` + `underline` |
| Input | `border-border` | `border-border-strong` |
| Application card | `border-border` | `border-border-strong` + `cursor-pointer` |
| Nav item (inactive) | transparent | `bg-sidebar-2` (#1C3A54) |
| Nav item (active) | `bg-sidebar-2` | no change — already at that state |
| Tag remove `×` | `text-ink-2` | `text-danger` |
| Icon button | transparent | `bg-surface-2` |

**Underline links on hover.** Colour alone is not a sufficient affordance — WCAG requires a non-colour indicator.

⚠️ **Touch devices have no hover.** Every hover cue must have a non-hover equivalent. Cards being tappable is conveyed by layout, not by a border change.

---

# 3 · DISABLED — VERIFIED FROM SOURCE

⚠️ **This section is superseded — `opacity-50` is wrong.** Real values, read 2026-08-27 from `M/Button — Disabled`, `M/Field — Disabled`, `M/Checkbox — Disabled`:

**Disabled is a genuine colour change, not a faded version of the enabled state.**

| Component | Fill | Text / icon | Stroke |
|---|---|---|---|
| Button | `$m-surface-2` #EFEBE3 | `$m-muted` #8B8778 | (none defined — button has no stroke normally) |
| Field | box `$m-surface-2`, label `$m-muted` | value `$m-muted` | box `$m-border` (down from `$m-border-strong`) |
| Checkbox | `$m-surface-2` | — | `$m-border` 1.3px |

```jsx
// Button
className={cn(BASE, disabled && 'bg-[--color-surface-2] text-[--color-muted]')}

// Field
className={cn(BASE, disabled && 'bg-[--color-surface-2] border-[--color-border]')}
<label className={cn(LABEL, disabled && 'text-[--color-muted]')}>
```

⚠️ **Every disabled treatment built before 2026-08-27 needs correcting** — `SCREEN-SPEC-M01.md`'s `LinkedInSSOButton` and any component in `TASKS-FRONTEND_quarterfinal.md` using `disabled:opacity-50` should switch to this colour-based treatment.

**What doesn't change:** `disabled:cursor-not-allowed` and `disabled:pointer-events-none` (buttons only) — these are behavioural, not visual, and nothing in the source contradicts them. Same for the rule that disabled state must never be the sole signal of *why* something is disabled — an adjacent text explanation is still required (see the LinkedIn button pattern).

---

# 3b · DISABLED — original proposal (superseded, kept for reference)

```css
disabled:opacity-50
disabled:cursor-not-allowed
disabled:pointer-events-none    /* buttons only — see below */
```

**Why opacity rather than a grey token:** opacity preserves the element's identity — a disabled primary button still reads as the primary button. Swapping to grey makes it look like a different control.

**⚠️ 50% opacity fails contrast requirements.** That's acceptable *only* because disabled controls are exempt from WCAG contrast minimums. But it means **disabled state must never be the sole carrier of meaning.**

| Element | Extra requirement |
|---|---|
| **LinkedIn SSO** | `title="Coming soon"` + `aria-disabled="true"` **and** visible helper text. Users must know *why*. |
| Generate (quota exhausted) | Adjacent text: *"0 generations left this month"* + upgrade link |
| Submit (form invalid) | Never disable on invalid — **let them submit and show errors.** A disabled submit with no explanation is a dead end |

**`aria-disabled` vs `disabled`:** use the real `disabled` attribute for buttons that genuinely cannot act. Use `aria-disabled="true"` without `disabled` when the element must stay focusable so a screen reader can announce why — the LinkedIn case.

---

# 4 · ERROR — VERIFIED FROM SOURCE

⚠️ **This section is superseded — the real structure is more specific than proposed.** Read 2026-08-27 from `M/Field — Error`:

**Two parts, not one.** The field box gets a border change; a separate row appears below it with an icon and message — not just red text with no icon.

```
Field box     stroke $m-danger, 1.5px (up from the normal 1px)
Error row     gap 6 below the box
  icon        lucide "circle-alert", 12×12, $m-danger
  message     mono 10.5px, normal weight, $m-danger
```

⚠️ **The message is mono, not body font** — matching the field label's typeface, not the field value's. This is a real, specific choice, not a default.

```jsx
<div className="flex flex-col gap-[7px]">
  <label className="…">{label}</label>
  <input aria-invalid={!!error} aria-describedby={error ? `${id}-error` : undefined}
         className={cn(FIELD_BASE, error && 'border-[--color-danger] border-[1.5px]')} />
  {error && (
    <div className="flex items-center gap-[5px]">
      <CircleAlert size={12} className="text-[--color-danger]" />
      <p id={`${id}-error`} className="font-mono text-[10.5px] text-[--color-danger]">
        {error}
      </p>
    </div>
  )}
</div>
```

**Placeholder message in the source:** *"Enter a valid value"* — generic, meant to be overridden per-field with a specific message (e.g. "Enter a valid email").

**What doesn't change:** the three-signal principle (border colour + icon + text, never colour alone) is honoured *more* strongly by this real structure than by the original proposal — an icon is now confirmed, not just suggested. Validation timing (blur, not per-keystroke) and the rule that auth errors never attach to a field are both unaffected by this correction.

---

# 4b · ERROR — original proposal (superseded, kept for reference)

## Field-level

```jsx
<input aria-invalid={!!error} aria-describedby={error ? `${id}-error` : undefined}
       className="border-[--color-border]
                  aria-[invalid=true]:border-[--color-danger]
                  aria-[invalid=true]:focus:outline-[--color-danger]" />
{error && (
  <p id={`${id}-error`} className="font-body text-[12px] text-[--color-danger]">
    {error}
  </p>
)}
```

**Three signals, not one:** red border (colour) · error text below (content) · `aria-invalid` (assistive tech). **Colour alone excludes colour-blind users.**

## Form-level

```jsx
<div role="alert" tabIndex={-1} ref={errorRef}
     className="border border-[--color-danger] bg-[--color-danger-soft]
                px-4 py-3 font-body text-[13px] text-[--color-danger]">
```

**Move focus to it on submit failure** (`errorRef.current.focus()`). Otherwise a screen-reader user submits, hears nothing, and has no idea what happened.

## Timing

| When | Behaviour |
|---|---|
| Typing | **No validation.** Validating per keystroke means "invalid email" appears at the first character |
| Blur | Validate that field |
| Submit | Validate all, focus the summary |
| After an error, typing again | **Clear that field's error immediately** — don't wait for blur |

⚠️ **Auth errors are the exception.** Login failures render one generic message regardless of cause (`SECURITY.md` §6, test #2). Never map a server auth error to a specific field — *"unknown email"* on the email field is account enumeration through the UI.

---

# 5 · LOADING

| Kind | Treatment |
|---|---|
| Button action | Spinner replaces label, `disabled`, `aria-busy="true"` |
| Initial page | Skeleton matching final layout — prevents layout shift |
| Background job (generation) | Non-blocking pending badge; the user keeps working (L091) |
| Inline (search) | Debounce 300ms, subtle spinner in the field |

**Buttons must disable while in flight.** A double-clicked login creates two session rows; a double-clicked generate consumes two quota units.

**Skeletons, not spinners, for initial load.** A spinner then content causes a layout jump; a skeleton sized like the content doesn't.

---

# 6 · ACTIVE / SELECTED

| Element | Treatment | Source |
|---|---|---|
| Nav item, active | `bg-sidebar-2` + 3px `--color-accent` left rail | Visible in the sidebar mockup |
| Board/List toggle | `bg-surface` + border on the selected segment | Mockup 03 |
| Tab, selected | 2px `--color-ink` bottom border, weight 600 | Mockup 05 |
| Location preference | `bg-primary` + white text | Mockup 02 |

`aria-current="page"` on the active nav item. `aria-selected` on tabs. `role="radiogroup"` + `aria-checked` on segmented controls.

---

# 7 · TRANSITIONS

## No server impact

CSS transitions run in each user's browser compositor. **A thousand concurrent users means a thousand local animations.** Nothing touches Railway, Postgres, or your connection pool. Concurrency is not a consideration here.

## What does matter — client-side

| Property | Cost |
|---|---|
| `opacity`, `transform` | **Compositor only** — GPU, cheap |
| `background-color`, `color`, `border-color` | Paint — fine at this scale |
| `width`, `height`, `top`, `left`, `margin`, `padding` | **Layout reflow — avoid** |

⚠️ **This matters most on the pipeline board.** Dragging a card while animating `width` on twenty siblings causes visible jank. Animating `transform` doesn't. `@dnd-kit` uses `transform` by default — a further argument for it over a hand-rolled implementation.

## Durations

| | Duration | Use |
|---|---|---|
| Instant | `duration-0` | Focus rings — **never animate focus**, it delays the indicator |
| Fast | `duration-150` | Hover on buttons, links, cards |
| Base | `duration-200` | Disabled toggling, error appearing |
| Slow | `duration-300` | Drawer slide, modal fade |

```css
transition-colors duration-150
```

**`transition-colors`, not `transition-all`.** `transition-all` animates layout properties by accident — including ones you never intended — and that's where jank comes from.

## Reduced motion

```css
motion-reduce:transition-none
motion-reduce:animate-none
```

Required for WCAG 2.2. Vestibular disorders are triggered by motion; the drawer slide and drag animations are the relevant ones here.

---

# 8 · THE COMPOSITE RULE

```css
/* the standard interactive element */
transition-colors duration-150
focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[--color-primary]
disabled:opacity-50 disabled:cursor-not-allowed
motion-reduce:transition-none
```

Applied to every button, link, input, and card. Put it in a shared `interactive` class or a `cn()` helper — **not copied into 30 components**, where it will drift.

---

# 9 · RESOLVED — no longer needs a human

Three of four items previously listed here are now verified from source (2026-08-27):

| | Was proposed | Now confirmed |
|---|---|---|
| Focus ring colour | `--color-primary` everywhere | **Buttons: `$m-accent`. Fields/checkboxes: `$m-primary`.** Inner stroke, not outline |
| Disabled treatment | `opacity-50` | **Colour change** — `$m-surface-2` fill, `$m-muted` text. No opacity involved |
| Error border | 1px `--color-danger` | **1.5px**, plus a confirmed icon+message row below, not just a border |

**Still genuinely open — no source found:**

| | Chosen | Alternative |
|---|---|---|
| Hover on surfaces | `--color-surface-2` | A dedicated hover token |
| Sidebar nav item focus | `$m-accent` (unverified proposal) | Untested against the source — no nav-item focus state exists in the file |

Corrections needed in already-built work: `SCREEN-SPEC-M01.md` (LinkedIn button's `opacity-50`), and any component in `TASKS-FRONTEND_quarterfinal.md` built against the superseded §1b/§3b/§4b values.

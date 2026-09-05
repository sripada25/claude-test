# SCREEN-SPEC-M03.md — Pipeline board

Full operational specification. Largest screen — 13 components, drag-and-drop, real-time derived state.

**Sources merged:** `SCREEN-NOTES-M03.md` (pen values) · `TASKS-FRONTEND_quarterfinal.md` M03 section · `BOARD-COMPONENT.md` (drag mechanics, jank, scale) · `INTERACTION-STATES.md` (corrected 2026-08-27) · `DATABASE_quarterfinal.md` §3 · `DECISIONS_quarterfinal.md` L104, L110, L113, L115, L120, L123

**Designer's intent, verbatim:** *"Six columns is a lot for one viewport. Rejected is collapsed and dimmed by default; the board scrolls horizontally rather than shrinking cards below a readable width."* · *"Cards show company, role, age, and status ticks only — the board is for scanning, not reading."* · *"Empty columns hold their place; the stage sequence is information even when a stage is empty."*

---

# SCREEN

**Mockup:** `Mockup___03_Pipeline_board.png` · pen source `qSU0e`
**Route:** `/app/board`
**GitHub Issue:** *(create per `ISSUES.md` before branching)*

---

# RESOLUTION

## Breakpoints

| Breakpoint | Width | Board behavior |
|---|---|---|
| Mobile | < 640px | Sidebar becomes a drawer. Board **still scrolls horizontally at 200px columns** — never shrinks cards |
| `md` | ≥ 768px | Filter chips return to the top bar from a "Filters" sheet |
| `lg` | ≥ 1024px | Sidebar becomes fixed 232px |

⚠️ **Two rules override everything else on this screen:**
1. **Touch targets never below 44×44px** — several controls (segmented toggle at `[7,16]` padding) need adjusted padding below `lg`
2. **The board never shrinks its columns.** Confirmed directly from the designer's note — this is not a general responsive guideline, it's specific and explicit for this screen

## Screen resolution — browser

**Design canvas:** 1440×900. Sidebar 232px fixed + main area filling the rest.

## Tablet resolution

**768–1023px:** filter chips (`Status`, `Source`, `Sort`) move into a collapsible "Filters" sheet — search and Add stay visible in the top bar. Board itself is unchanged; horizontal scroll already handles narrower viewports.

## Mobile resolution

**< 640px:** sidebar is a drawer, triggered by a hamburger icon that appears in the top bar. Board content area gets the full viewport width once the drawer is closed; columns still scroll horizontally at their fixed 200px.

## Screen background

`bg-[--color-bg]` (#F5F3EF) for the board area. Top bar and cards are `$m-surface` (white).

```jsx
<div className="flex h-screen bg-[--color-bg]">
  <Sidebar />
  <main className="flex flex-1 flex-col overflow-hidden">
```

---

# TASKS LIST

| Task ID | Component |
|---|---|
| M03-01 | BoardTopBar |
| M03-02 | SearchInput |
| M03-03 | FilterChip x3 (Status, Source, Sort) |
| M03-04 | ViewToggle (Board/List) |
| M03-05 | AddApplicationButton |
| M03-06 | StageColumn |
| M03-07 | ColumnHeader (collapse control) |
| M03-08 | ApplicationCard |
| M03-09 | CardTag |
| M03-10 | EmptyColumn |
| M03-11 | CollapsedColumn |
| M03-12 | DragContext (dnd-kit setup) |
| M03-13 | OptimisticMove (drag then API then rollback) |

Backend dependencies: **F2-2.1** create · **F2-2.2** list (search/filter/sort) · **F2-2.3** get single · **F2-2.4** patch (status change) · **F2-2.7** timeline events.

---

# DATABASE SCHEMA — every read and write this screen produces

| On screen | Table.column | Notes |
|---|---|---|
| Company, role (card) | `applications.company`, `.role` | read only here |
| Status (column placement) | `applications.status` | **written on drag** |
| Age tag | derived from `applications.last_activity_at` | computed client-side from a returned timestamp |
| Follow up tag | **derived**, not stored | see CardTag below |
| Doc tag | count of `documents` where `application_id` matches | |
| Due Fri tag | `applications.assessment_due_at` | |
| Tue 3pm tag | `applications.interview_at` | written by F5, read here |
| Source filter | `applications.source` enum | L110 |
| Sort | `applications.last_activity_at`, `.date_applied`, `.company` | |

⚠️ **Every query behind this screen filters `deleted_at IS NULL`** (L123). The composite index `idx_applications_board (user_id, status, last_activity_at DESC) WHERE deleted_at IS NULL` serves scope, grouping, and sort in one index.

**Full reference:** `DATABASE_quarterfinal.md` §3.1.

---

# API CALLS

| Trigger | Endpoint | Method |
|---|---|---|
| Page load | `/api/applications` | GET |
| Search typed (debounced) | `/api/applications?q=` | GET |
| Filter/sort changed | `/api/applications?status=&source=&sort=` | GET |
| Card dragged to a new column | `/api/applications/:id` | PATCH `{ status }` |
| Add application clicked | opens drawer (M04), no call from this screen | — |
| Column header clicked | client-side only, no call | — |

---

# ON SUCCESS

```
Page load success
   |
   Board renders with returned applications grouped by status
   |
   Empty columns render EmptyColumn ("Nothing here yet") - they
   still exist, never hidden (designer's note)

Card click
   |
   -> /app/applications/:id  (M05, Application detail)

Drag then drop on a new column
   |
   Optimistic move (instant, before the API responds)
   |
   PATCH succeeds -> stays. PATCH fails -> rolls back + error toast
   |
   (never navigates - stays on the board either way)

Add Application button
   |
   -> Drawer opens (M04) - does not navigate away from this screen
```

---

# FRONTEND COMPONENT REFERENCE

- **1 top bar** — search, three filter chips, view toggle, Add button
- **6 stage columns** — Saved, Applied, Assess, Interview, Offer, Rejected (collapsed by default)
- **Cards within columns** — variable count, zero or more per column
- **1 drag context** wrapping the whole board — not a visible component, but structurally present around every column and card

No modal, no drawer on this screen itself (the drawer belongs to M04, triggered from here).

---
---

# COMPONENT-BY-COMPONENT

## BoardTopBar

**Tailwind:** `flex h-16 items-center gap-[14px] border-b border-[--color-border] bg-[--color-surface] px-7`

64px height — confirmed against the same normalization applied to M02, M05, M06's chrome.

---

## SearchInput

**Tailwind (rest):**
```
flex w-[230px] items-center gap-2 border border-[--color-border] bg-[--color-bg] px-3 py-[9px]
```

⚠️ **Fill is `$m-bg`, not `$m-surface`** — inset against the white top bar, same inversion pattern as M02's dropzone.

**onFocus:** `border-[--color-primary]`, plus `ring-2 ring-inset ring-[--color-primary]` on the container (corrected 2026-08-27 — was previously specced as an outline).

**onChange:** debounced 300ms before firing the API call. Typing doesn't trigger a request on every keystroke.

**onClear** (if implemented as an X inside the field): resets to the unfiltered board, clears the query param.

**Input data sent to:** `GET /api/applications?q=` — **never string-concatenated into SQL.** The backend parameterizes this as `ILIKE $1` with the wildcard added server-side, searching `company` and `role` only.

**Performance:** client-side filtering is viable at this project's actual scale (~240 rows for a full year of a single user's applications per the earlier sizing math) — the debounce exists for UX smoothness, not because the query is expensive.

---

## FilterChip — Status, Source, Sort (3 instances, 1 component)

**Tailwind (rest):**
```
flex items-center gap-[5px] border border-[--color-border-strong] bg-[--color-surface] px-3 py-2
```

**onClick:** opens a dropdown — `role="listbox"` for Status/Source (multi-select), single-select for Sort.

**Active state** (a filter is applied): `bg-[--color-primary-soft] text-[--color-primary]` — not drawn in the mockup, this is our own addition reusing the `StepChip` treatment already established on M02.

⚠️ **The chip label carries the current value** — "Sort: Recent" is the actual button text, not a static "Sort" label with a separate value display elsewhere.

**Sort options:** Recent · **Oldest activity** (surfaces stale applications — the product's core diagnostic value, per the PRD's page-7 thesis) · Date applied · Company A-Z.

**Source filter, empty state:** if the user has no applications with a `source` set, the dropdown shows a prompt to add sources rather than an empty list.

**onFocus:** `ring-2 ring-inset ring-[--color-primary]`.
**onKeyDown (Escape):** closes the dropdown, returns focus to the chip.

---

## ViewToggle (Board/List)

**Tailwind (outer track):** `flex border border-[--color-border] bg-[--color-bg] p-[3px] gap-[2px]`

**Selected segment:** `bg-[--color-surface] border border-[--color-border]`
**Unselected segment:** no fill, no border, `text-[--color-muted]`

⚠️ **This is a different selected-state pattern from M02's `LocationSegmented`** — inset track with a raised selected segment, versus M02's filled-primary selected segment. Both are correct; they're distinguishing a *value picker* (M02) from a *view switcher* (here).

⚠️ **List is not a secondary/lesser view.** Designer's note: *"At 30+ active applications the board stops scanning well — List is the working view for volume, Board for weekly review."* Given the PRD's 20-50 applications/month, most active users will live in List at least part of the time.

**onClick:** switches view, **persists the choice in a cookie** (readable server-side on next load, avoiding a flash of the wrong view).

**onFocus:** `ring-2 ring-inset ring-[--color-primary]`.
**A11y:** `role="radiogroup"`, arrow-key navigation between the two options.

---

## AddApplicationButton

**Tailwind:** identical to the primary `Button`, but `size="sm"` — padding `[10,18]` versus the base `[13,22]`.

**onClick:** opens the drawer (M04). Does not navigate away from this screen — the board stays rendered behind the drawer, dimmed.

**onHover:** `bg-[--color-primary]` to `bg-[--color-primary-hover]`.
**onFocus:** `ring-2 ring-inset ring-[--color-accent]` (buttons use accent, per the verified source).

---

## StageColumn

**Fixed width, always:** `w-[200px]` — never responsive, never shrinks (designer's explicit note).

**Tailwind (body):** `max-h-[calc(100vh-220px)] overflow-y-auto` — native scroll, scrollbar appears only when content overflows, exactly matching the dynamic behavior originally requested. **No virtualization** — confirmed unnecessary at realistic scale (~50 cards/column after six months), and virtualization would actively fight the drag-and-drop's auto-scroll behavior.

**Stage colours, exact:**

| Stage | Colour token |
|---|---|
| Saved | `$m-muted` |
| Applied | `$m-primary` |
| Assess (enum: `assessment`) | `$m-warning` |
| Interview | `$m-violet` |
| Offer | `$m-success` |
| Rejected | `$m-danger` |

⚠️ **Displayed label "Assess" is not the same as the stored enum value `assessment`** (L104) — a display-mapping concern, not a data concern.
⚠️ **Colours built via a static lookup object**, never string-interpolated into a Tailwind class — interpolated class names get purged from the production build since Tailwind can't statically analyze them.

---

## ColumnHeader (collapse control)

```jsx
<button onClick={toggle} aria-expanded={!collapsed} aria-controls={`col-${stage}`}
        className="flex w-full items-center gap-[7px] px-0.5 pb-2.5
                   focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[--color-accent]">
  <span className={cn('size-[7px]', STAGE[stage].dot)} aria-hidden />
  <span className="font-body text-[13px] font-semibold text-[--color-ink]">{label}</span>
  <span className="ml-auto font-mono text-[11.5px] text-[--color-muted]">{count}</span>
</button>
```

**onClick:** toggles collapse. **Fires only on the header itself**, not the whole column body — clicking near a card (empty space in the column) does not collapse it, since that's a frequent mis-click.

⚠️ **Any column can collapse, not just Rejected.** Rejected is merely shown collapsed by default in the mockup — the designer's note confirms this is demonstrating the collapsed *appearance*, not making Rejected special.

**onHover:** subtle background tint on the header row, `bg-[--color-surface-2]` — not pen-verified, our own addition for affordance.

**Persisted per-column** in a cookie — collapse state survives a page reload.

---

## ApplicationCard

**Structure — the stroke is deliberately asymmetric:**
```
stroke: {right: 1, bottom: 1, left: 1}   <- NO top border
+ a separate 3px rectangle child, fill = stage colour, spanning full width
```

⚠️ **`border-t-[3px]` in code would be wrong.** The coloured strip is a distinct child element, not a thick top border on the card itself — this matters because a border and a child element behave differently under hover/focus state changes.

```jsx
<article ref={setNodeRef} {...listeners} {...attributes}
         style={{ transform: CSS.Translate.toString(transform) }}
         onClick={() => router.push(`/app/applications/${id}`)}
         className="flex cursor-pointer flex-col border-x border-b border-[--color-border]
                    bg-[--color-surface] hover:border-[--color-border-strong]
                    focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[--color-accent]">
  <div className={cn('h-[3px] w-full', STAGE[stage].bar)} aria-hidden />
  <div className="flex flex-col gap-1.5 px-3 pb-3 pt-[11px]">
    <span className="font-body text-[13px] font-semibold text-[--color-ink]">{company}</span>
    <span className="font-body text-[11.5px] text-[--color-ink-2]">{role}</span>
    <div className="flex flex-wrap items-center gap-[5px]">{tags}</div>
  </div>
</article>
```

**onClick:** navigates to the detail screen (M05).

**onDrag start:** requires an 8px movement before drag registers (`activationConstraint: { distance: 8 }`) — this is what separates a click from a drag. Without it, every click would register as a 2px drag and the card would never open.

**onHover:** `border-[--color-border]` to `border-[--color-border-strong]`.

**onFocus (keyboard):** `ring-2 ring-inset ring-[--color-accent]`.

⚠️ **No hover delete (x) on cards.** Rejection is already a status; a delete affordance under the cursor during drag is dangerous, and hover doesn't exist on touch. Deletion lives on the detail screen, behind the overflow menu, available only when status is Rejected.

**Content is deliberately capped** at company, role, and tags — designer's note: *"the board is for scanning, not reading."* Resist adding fields here even if they'd be useful; that's what the detail screen is for.

---

## CardTag

**Two variants:**

| | Fill | Text |
|---|---|---|
| Default (age, Doc, Due Fri, Tue 3pm) | `$m-surface-2` | mono `9.5`/600 `$m-ink-2` |
| Follow up | `$m-accent-soft` | mono `9.5`/600 `$m-accent` |

⚠️ **Smaller than `M/Tag`** — `[3,7]` padding at 9.5px, versus the base component's `[5,10]` at 10.5px. This is a size variant, not a separate component.

### The Follow-up tag is derived, never a stored flag

Designer's note: *"It's a state on the card, not only a notification, so it survives a missed email."*

```sql
status IN ('applied','assessment','interview')
AND date_applied < now() - interval '7 days'
AND NOT EXISTS (
  SELECT 1 FROM application_events
  WHERE application_id = a.id AND type = 'follow_up_sent'
)
AND (follow_up_snoozed_until IS NULL OR follow_up_snoozed_until < now())
```

⚠️ **Snoozing hides the tag; a failed email send does not** (L120) — a system failure must stay visible so the loop can't fail silently; a user's own snooze decision is respected.

**onClick (the Follow-up tag specifically):** this is a `<button>`, not a static badge — clicking it navigates into the follow-up draft flow (F4). It needs its own focus ring and 44px effective tap target even though the visual chip is smaller.

⚠️ **Overflow rule:** cards can produce up to 4 tags at once (age + Follow up + Doc + a stage-specific date), but the card is only 200px wide — `Call log` plus `Tue 3pm` already fills the available row. **Cap at 2 visible tags, with a `+N` overflow indicator** (L115), prioritizing the Follow-up tag first since it's the only actionable one.

**A11y:** the age tag needs `aria-label="Last activity 2 days ago"` — "2d" alone is meaningless read aloud by a screen reader.

---

## EmptyColumn

**Tailwind:** `flex h-14 items-center justify-center border border-[--color-border] bg-[--color-bg]`
Content: "Nothing here yet" — body `12`/normal `$m-muted`.

⚠️ **Renders even when a stage has zero applications, always.** Never collapse or hide an empty column — designer's note: *"the stage sequence is information even when a stage is empty."* A user should be able to see all six stages exist even on day one with nothing in most of them.

---

## CollapsedColumn (Rejected, by default)

**Tailwind:** `flex w-14 flex-col items-center gap-4 py-1`

**Label rotation:**
```jsx
<span className="font-body text-[12.5px] font-semibold text-[--color-ink-2]
                 [writing-mode:vertical-rl] rotate-180">
  Rejected
</span>
```

⚠️ **`[writing-mode:vertical-rl] rotate-180`, not a plain `rotate-90`** — the combination reads bottom-to-top, matching the pen source's `rotation: -90` exactly. A naive `rotate-90` alone reads top-to-bottom, which is backwards.

**onClick:** expands the column back to its normal 200px width.

⚠️ **Remains a valid drop target while collapsed** — dragging a card onto the collapsed rail must work without first expanding it. This is a real implementation requirement, not just a visual nicety: `@dnd-kit`'s droppable zone must stay registered on the 56px collapsed frame, not only the 200px expanded one.

---

## DragContext (dnd-kit setup)

Not a visible component — the sensor and context configuration wrapping the whole board.

```jsx
const sensors = useSensors(
  useSensor(PointerSensor,  { activationConstraint: { distance: 8 } }),
  useSensor(TouchSensor,    { activationConstraint: { delay: 200, tolerance: 8 } }),
  useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
);
```

**Why `@dnd-kit` and not a hand-built drag implementation:** the reason is accessibility, not implementation difficulty. The library provides Space-to-lift, arrow-key movement, Space-to-drop, Escape-to-cancel, and ARIA live announcements out of the box. Building this from scratch means re-implementing keyboard sensors, screen-reader announcements, touch handling, and collision detection — genuinely weeks of work, landing somewhere worse than a maintained library.

**Never animate `width`, `top`, `left`, or `margin` during drag** — only `transform` via `CSS.Translate.toString(transform)`. This is a real performance distinction: animating `width` forces the browser to recalculate every sibling's layout on every frame (20 cards times 60fps = 1,200 layout recalculations per second), while `transform` is handled entirely by the GPU compositor, skipping layout and paint.

⚠️ **Jank from this is a per-browser concern, not a per-server one** — a single user on a single machine can produce it. Ten concurrent users never compete for this resource; each renders in their own browser.

**Not a violation of "no component library" (L020)** — `@dnd-kit` ships zero CSS and no visual components. It's behavior only; every class name is supplied by us.

---

## OptimisticMove

```jsx
const move = async (id, from, to) => {
  setCards(prev => reposition(prev, id, to));          // instant, before the API responds
  try {
    const res = await fetch(`/api/applications/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', 'X-CSRF-Token': csrf },
      body: JSON.stringify({ status: to }),
    });
    if (!res.ok) throw new Error();
  } catch {
    setCards(prev => reposition(prev, id, from));      // snap back on failure
    showError('Could not update - please try again');
  }
};
```

⚠️ **The rollback is not optional.** Without it, a failed PATCH leaves the UI showing a status the database doesn't actually have — the user believes the move saved when it didn't.

**Concurrency — two tabs, same card, moved simultaneously:** last write wins. Both writes originate from the same person; there's no meaningful data loss, only a status they can immediately correct if it's wrong. Optimistic locking (a version column, conflict UI) is unnecessary complexity for a single-user resource — revisit only if shared/team boards are ever added.

⚠️ **This uses the exact same backend service function as M05's status dropdown.** Designer's note: *"Status changes from here and from the board drag. Both write the same timeline event - one code path, two entry points."* The frontend call differs (drag vs. dropdown click); the backend logic must not.

**Timeline event debounce:** a fidgety drag that moves a card between three columns before settling should write **one** timeline event for the final position, not three. Debounce 2 seconds on the settled state before calling `PATCH`.

**Security:** CSRF token required on the PATCH. `user_id` is derived from the session server-side, never trusted from any client-supplied field.

---
---

# SCALE CHECK — this screen at your actual numbers

At 10 free users over a 12-day trial, 2 applications/day each: **240 total applications**, roughly 4 cards per column. The board's single indexed query returns before the network round-trip even finishes. **This screen is not a performance concern at any realistic point in the first year** — the only genuine bottleneck in the whole product is Gemini's generation rate limit, which this screen never touches.

---

# CONFIRM BEFORE M04

Same check as the prior two screens — is this the right depth? M04 (Add application drawer) is next, smaller than this one but with the prompt-injection security notes and the missing Source field resolution both needing full treatment.

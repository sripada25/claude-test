# SCREEN-NOTES-M03.md — Pipeline board

Pen source: `qSU0e` — "Mockup — 03 Pipeline board" · 1440×900 · read 2026-08-26
Screen: `Mockup___03_Pipeline_board.png`

**Design intent from plate `iHpHi` notes** (wireframe plate — notes only, styling ignored):

> *"Six columns is a lot for one viewport. Rejected is collapsed and dimmed by default; the board scrolls horizontally rather than shrinking cards below a readable width."*
> *"Board and List are equal views, not a toggle-and-forget. At 30+ active applications the board stops scanning well — List is the working view for volume, Board for weekly review."*
> *"Follow-up flag is the product's core loop. Fires 7 days after the applied date. It's a state on the card, not only a notification, so it survives a missed email."*
> *"Empty columns hold their place rather than collapsing — the stage sequence is information even when a stage is empty."*
> *"Cards show company, role, age, and status ticks only. Everything else is one click away in detail — the board is for scanning, not reading."*

Architecture, drag-and-drop and performance analysis: `BOARD-COMPONENT.md`. This document is the visual spec.

---

# 1 · LAYOUT

```
qSU0e   fill $m-bg · 1440×900 · horizontal
├─ BHSgg  REF -> ErsAL (M/Sidebar)  ·  232 fixed · h fill
└─ S8wiEe Main  · vertical · fill
   ├─ dimnj  Top bar  fill $m-surface · border-bottom $m-border 1 · h 68 · pad [0,28] · gap 14 · align center
   └─ dG1Fh  Body     pad [26,28]
      └─ oI08b Board  gap 16 · horizontal
```

```jsx
<div className="flex h-screen bg-[--color-bg]">
  <Sidebar />                                        {/* 232px fixed */}
  <main className="flex flex-1 flex-col overflow-hidden">
    <header className="flex h-[68px] shrink-0 items-center gap-3.5 border-b border-[--color-border] bg-[--color-surface] px-7">
    <div className="flex-1 overflow-x-auto px-7 py-[26px]">
      <div className="flex gap-4">                   {/* columns */}
```

⚠️ **Horizontal scroll, never shrink** — designer's note 1. Columns are a fixed 200px; the board scrolls. **Do not use `flex-wrap` or percentage widths.**

**Responsive:** sidebar becomes a drawer below `lg`. The board already scrolls horizontally, so it works on mobile unchanged.

---

# 2 · TOP BAR

## 2.1 · `SearchInput` — `maEop`

```
fill $m-bg · stroke $m-border 1 · pad [9,12] · gap 8 · w 230 · align center
  icon  lucide "search" 15×15 $m-muted
  text  "Search company or role"  body 13/normal  $m-muted
```

⚠️ **fill is `$m-bg`, not `$m-surface`** — inset against the white top bar. Same inversion as M02's dropzone.

```jsx
<div className="flex w-[230px] items-center gap-2 border border-[--color-border] bg-[--color-bg] px-3 py-[9px] focus-within:border-[--color-primary]">
  <Search size={15} className="text-[--color-muted]" />
  <input placeholder="Search company or role"
         className="w-full bg-transparent font-body text-[13px] outline-none placeholder:text-[--color-muted]" />
</div>
```

**React** — debounce 300ms. Searches `company` and `role`.
**API** — `GET /api/applications?q=` (F2-2.2)
**Security** — **parameterised query, never string-concatenated.** `ILIKE $1` with the wildcard added server-side.
**Performance** — client-side filter is viable at your scale (~240 rows). Server-side once a user passes ~500 applications.
**Refs** — F2-3.11 · F2-2.2

## 2.2 · `FilterChip` × 3 — `FMscm` `zuhxj` `vu9PL`

**Identical structure. One component, three instances.**

```
fill $m-surface · stroke $m-border-strong 1 · pad [8,12] · gap 5 · align center
  text  body 12.5/500  $m-ink-2
  icon  lucide "chevron-down" 13×13  $m-muted
```

| Instance | Label | Opens |
|---|---|---|
| `FMscm` | "Status" | multi-select, 6 stages |
| `zuhxj` | "Source" | multi-select from the `source` enum (L110) |
| `vu9PL` | **"Sort: Recent"** | single-select |

⚠️ **The label carries the current value** — `Sort: Recent`, not `Sort`. When a filter is active it should read `Status: Applied, Interview` or similar. Active state isn't drawn — use `$m-primary-soft` fill with `$m-primary` text (the `StepChip` pattern from M02).

**Sort options** (F2-3.14 + `BOARD-COMPONENT.md` §7): Recent · **Oldest activity** · Date applied · Company A–Z.
**Source filter empty state** — prompt the user to add sources rather than an empty dropdown (L110).

## 2.3 · `ViewToggle` — `Y6Kqf`

```
Outer  fill $m-bg · stroke $m-border 1 · pad 3 · gap 2
  Board (selected)   fill $m-surface · stroke $m-border 1 · pad [7,16] · text $m-ink body 12.5/600
  List  (unselected) no fill, no stroke        · pad [7,16] · text $m-muted body 12.5/500
```

⚠️ **A different selected-state pattern from M02's location control.** Here: inset track, selected segment is raised (`$m-surface` on `$m-bg`). M02: selected is `$m-primary` filled.

**Both are valid — they're different controls.** M02 picks a *value*; this switches a *view*. Build `SegmentedControl` with a `variant` prop: `'filled'` (M02) and `'inset'` (here).

**React** — persist choice in a cookie (`BOARD-COMPONENT.md` §4).
**A11y** — `role="radiogroup"`, arrow keys, `aria-checked`.

## 2.4 · `AddApplicationButton` — `N6bZj` → `M/Button`

```
ref zK0k4 · padding overridden to [10,18]  (base is [13,22])
```

Smaller than the base button. **Add a `size` prop** — `sm` `[10,18]`, `md` `[13,22]`.
**onClick** → opens the drawer (M04). Does not navigate.

---

# 3 · BOARD

## 3.1 · `StageColumn` — six instances

```
w 200 · vertical
Head   pad [0,2,10,2] · justify space-between · align center
  Left  gap 7 · align center
    dot   7×7 rectangle — colour per stage
    name  body 13/600  $m-ink
  count   mono 11.5/normal  $m-muted
Stack  gap 10 · vertical
```

### Stage colours — exact

| Stage | Dot fill | Card top bar |
|---|---|---|
| Saved | `$m-muted` | `$m-muted` |
| Applied | `$m-primary` | `$m-primary` |
| Assess | `$m-warning` | `$m-warning` |
| Interview | `$m-violet` | `$m-violet` |
| Offer | `$m-success` | — |
| Rejected | `$m-danger` | — |

**The dot and the card's top bar use the same token.** One `stageColor(stage)` helper.

⚠️ **Column label reads "Assess"; the enum value is `assessment`** (L104). Display label ≠ stored value.

**Column width is fixed 200px.** Cards are `fill_container` inside.

## 3.2 · `ApplicationCard`

```
fill $m-surface
stroke $m-border {right:1, bottom:1, left:1}     ← NO top border
├─ top bar  rectangle · fill = stage colour · h 3 · full width
└─ Inner    pad [11,12,12,12] · gap 6 · vertical
   ├─ company  body 13/600    $m-ink
   ├─ role     body 11.5/normal  $m-ink-2
   └─ Tags     gap 5 · align center
```

⚠️ **The top border is absent and replaced by a 3px coloured rectangle.** Not `border-t-[3px]` — an actual child element, because the stroke is explicitly `{right, bottom, left}`.

```jsx
<article className="flex flex-col border-x border-b border-[--color-border] bg-[--color-surface]">
  <div className="h-[3px] w-full" style={{ backgroundColor: stageColor }} />
  <div className="flex flex-col gap-1.5 px-3 pb-3 pt-[11px]">
    <span className="font-body text-[13px] font-semibold text-[--color-ink]">{company}</span>
    <span className="font-body text-[11.5px] text-[--color-ink-2]">{role}</span>
    <div className="flex items-center gap-[5px]">{tags}</div>
  </div>
</article>
```

**Content is capped at company · role · tags** — designer's note 6: *"the board is for scanning, not reading."* Resist adding fields.

**onClick** → `/app/applications/:id` (M05)
**Drag** → `PATCH /api/applications/:id { status }`, optimistic with rollback
⚠️ **`activationConstraint: { distance: 8 }`** separates click from drag (`BOARD-COMPONENT.md` §3)
**Refs** — F2-3.4 · F2-2.3 · F2-2.4

## 3.3 · `CardTag` — two variants

```
DEFAULT   fill $m-surface-2 · pad [3,7] · gap 4 · text mono 9.5/600 $m-ink-2
FOLLOW-UP fill $m-accent-soft · pad [3,7] · gap 4 · text mono 9.5/600 $m-accent
```

⚠️ **Smaller than `M/Tag`** — `M/Tag` is `[5,10]` at 10.5px; card tags are `[3,7]` at 9.5px. **A `size` prop on `Tag`**, not a new component.

Observed tags: `2d` `5d` `7d` `3d` `1d` (age) · **`Follow up`** (accent) · `Doc` · `Call log` · `Due Fri` · `Tue 3pm`

### ⚠️ The `Follow up` tag is a derived state, not a stored flag

Designer's note 3: *"Follow-up flag is the product's core loop… It's a state on the card, not only a notification, so it survives a missed email."*

**It must be computed, not read from a `reminders` row:**

```sql
status IN ('applied','assessment','interview')
AND date_applied < now() - interval '7 days'
AND no follow-up event recorded
```

**Why this matters:** if the tag depended on a `reminders` record, a failed email send would mean the card silently never flags. Deriving it from the application's own dates makes the loop resilient — which is exactly what the note says.

**This is an F4 requirement discovered in an F2 screen.** Not currently in any task.

## 3.4 · `EmptyColumn` — `mxaom`

```
fill $m-bg · stroke $m-border 1 · h 56 · centred
text  "Nothing here yet"  body 12/normal  $m-muted
```

⚠️ **Empty columns hold their place** — note 5. Never collapse or hide an empty stage; the sequence is information.

## 3.5 · `CollapsedColumn` — `qhz66` (Rejected)

```
w 56 · h 220 · pad [4,0] · vertical · align center
  dot    7×7  $m-danger
  label  body 12.5/600  $m-ink-2  ·  rotation: -90
  count  mono 12/normal  $m-muted
```

⚠️ **The label is rotated −90°.** Vertical text.

```jsx
<div className="flex w-14 flex-col items-center gap-4 py-1">
  <span className="size-[7px]" style={{ background: 'var(--color-danger)' }} />
  <span className="font-body text-[12.5px] font-semibold text-[--color-ink-2] [writing-mode:vertical-rl] rotate-180">
    Rejected
  </span>
  <span className="font-mono text-[12px] text-[--color-muted]">9</span>
</div>
```

**`[writing-mode:vertical-rl] rotate-180` reads bottom-to-top**, matching −90°. A plain `rotate-90` would read top-to-bottom.

**Per your decision: any column can collapse.** Rejected is merely shown collapsed by default (note 1). Collapse state persists per column in a cookie.
⚠️ **Collapsed columns remain drop targets** — dragging onto the rail must work without expanding first.

---

# 4 · WHAT'S NOT DRAWN

| | Why needed | Task |
|---|---|---|
| **Drag states** | No lift, drop-target, or ghost styling | F2-3.6 |
| **Loading skeleton** | Board fetches on mount | F2-3.3 |
| **Whole-board empty state** | New user, zero applications | F2-3.3 |
| **Active filter chip** | No styling for a filter in use | F2-3.12 |
| **Column scroll** | Beyond ~8 cards | F2-3.3 |
| **List view** | Note 2 says it's the working view at 30+ | F2-3.9 |
| **Delete (×) in Rejected** | Your decision — delete only from Rejected | F2-3.4 |

**Proposed drag states** (from `INTERACTION-STATES.md`): lifted card `opacity-90` + `scale-[1.02]` · drop target `$m-primary-soft` fill on the Stack · original position `opacity-40`.

---

# 5 · OPEN

| | Question |
|---|---|
| 1 | **Card tags are unlabelled** — `2d` and `Due Fri` and `Tue 3pm` all render identically. Is `Due Fri` a reminder and `Tue 3pm` an interview time? They need distinct semantics, and possibly distinct colours |
| 2 | **How many tags fit?** Card is 200px wide. `Call log` + `Tue 3pm` already fills it. Truncate, wrap, or cap at 2? |
| 3 | **Delete (×) placement in Rejected** — hover only? Always visible? Hover fails on touch |
| 4 | Does the count in a collapsed column update live during drag? |

---

# 6 · COMPONENT REUSE — running total

| Component | Status after M03 |
|---|---|
| `Sidebar` | ✅ exact (`ErsAL`) |
| `Button` | **+`size` prop** — `[10,18]` here vs `[13,22]` base |
| `Tag` | **+`size` and `variant`** — 3 sizes now: card 9.5 · M/Tag 10.5 · skill chip |
| `SegmentedControl` | **+`variant`** — `filled` (M02) · `inset` (M03) |
| `SearchInput` | new |
| `FilterChip` | new — 3 instances |
| `ApplicationCard` | new |
| `StageColumn` | new |
| `EmptyState` | new |
| `CollapsedColumn` | new |

**Four screens in, three components need variant props rather than duplicates.** That's the inventory converging — worth building `Button`, `Tag` and `SegmentedControl` with their full variant sets before anything else.

# BOARD-COMPONENT.md — Pipeline Board (Mockup 03)

The most complex UI in Trackr. Architecture, drag-and-drop, and an honest performance analysis.

---

# 1 · JANK — WHAT IT ACTUALLY IS

**Not a concurrency problem.** A single user, alone, offline, can produce jank.

The browser has **16.7ms** per frame at 60fps. Within that window it must run JavaScript, recalculate style, do layout, paint, and composite. Exceed the budget and the frame is dropped — the user sees stutter.

## The rendering pipeline

```
JS  →  Style  →  Layout  →  Paint  →  Composite
                   ↑          ↑          ↑
            animating       animating   animating
            width/top       colors      transform/opacity
            runs ALL of it  runs these  runs ONLY this  ← cheap, GPU
```

**Animating `width` on a dragged card** forces the browser to recalculate the geometry of every sibling in that column, every frame. Twenty cards × 60 frames/second = 1,200 layout calculations per second.

**Animating `transform`** skips layout and paint entirely. The GPU moves an already-painted layer. Effectively free.

**This is why `@dnd-kit` uses `transform`.** It isn't an optimisation you'd add later — it's the difference between a board that feels solid and one that stutters.

**Your question — "per user one session, how can it create jank?"** — the answer is that jank is per-browser, not per-server. Ten users each get their own 16.7ms budget on their own hardware. They never compete.

---

# 2 · HOW GITHUB PROJECTS DOES IT

Three techniques, all applicable to you:

| | What | Do you need it? |
|---|---|---|
| **Transform-based drag** | Never touch layout properties during drag | ✅ Yes — `@dnd-kit` default |
| **Optimistic update** | Card moves instantly; server confirms after | ✅ Yes |
| **Virtualization** | Render only visible cards in long columns | ❌ **No** — see §6 |

No secret sauce. Avoid layout thrash, let the GPU move pixels, don't wait for the network.

---

# 3 · COMPONENT ARCHITECTURE

Your model is right. Formalised:

```
<PipelineBoard>                    manages drag context, holds application state
  <BoardToolbar>                   search · filters · sort · Board|List · Add
  <BoardColumns>                   horizontal flex, scrolls on narrow screens
    <StageColumn stage="saved">    droppable target
      <ColumnHeader>               dot · label · count · collapse toggle
      <ColumnBody>                 vertical scroll when needed
        <ApplicationCard />        draggable + clickable
        <ApplicationCard />
      </ColumnBody>
    </StageColumn>
    … applied · assessment · interview · offer
    <StageColumn stage="rejected" collapsed />   the right rail
```

## Click targets — the conflict you need to resolve

Three different clicks in the same area:

| Click on | Action |
|---|---|
| **Column header** | Collapse / expand that column |
| **Card body** | Navigate to Application detail (Mockup 05) |
| **Card drag** | Move between columns |

⚠️ **Card click vs card drag is the real problem.** A 2px accidental movement while clicking must not become a drag, or the card never opens.

**Solution — activation constraint:**

```js
useSensor(PointerSensor, {
  activationConstraint: { distance: 8 }   // 8px before drag begins
})
```

Under 8px of movement, it's a click. Over, it's a drag. Standard, and it's what makes card-as-link work alongside drag.

**On touch**, use a delay instead — otherwise scrolling the column starts a drag:

```js
useSensor(TouchSensor, {
  activationConstraint: { delay: 200, tolerance: 8 }
})
```

Press and hold for 200ms to drag; a swipe scrolls.

---

# 4 · COLLAPSE / EXPAND

Your spec: click a column to collapse; click a collapsed column to expand.

**One refinement — collapse on the header, not the whole column.** Clicking anywhere in the column body would fire whenever a user clicks empty space near a card, which is a frequent misclick.

```jsx
<button onClick={toggle} aria-expanded={!collapsed}
        aria-controls={`col-${stage}`}
        className="flex w-full items-center gap-2 ...">
  <span className="size-2" style={{ background: stageColor }} />
  <span className="font-mono text-[10.5px] font-semibold uppercase tracking-[0.8px]">
    {label}
  </span>
  <span className="ml-auto text-[--color-muted]">{count}</span>
</button>
```

**Collapsed columns must still be drop targets.** Dragging a card onto a collapsed "Rejected" rail should work — otherwise the user has to expand it first, which is friction at the exact moment they want speed.

**Persist collapse state in a cookie**, not `localStorage` — it survives, and it's readable server-side for the initial render, avoiding a flash of the wrong layout.

---

# 5 · CARDS — WHEN THEY EXIST, WHAT THEY SHOW

You're right: a card is a row in `applications`, created via Mockup 04, placed by its `status` column, scoped to `user_id`.

```jsx
<article ref={setNodeRef} style={{ transform: CSS.Translate.toString(transform) }}
         {...listeners} {...attributes}
         onClick={() => router.push(`/app/applications/${id}`)}
         className="border-t-2 border border-[--color-border] bg-[--color-surface]
                    p-4 hover:border-[--color-border-strong] cursor-pointer"
         style={{ borderTopColor: stageColor }}>
```

From the mockup: company (600), role (`$m-ink-2`), age badge (`2d`), tag chips (`Follow up`, `Call log`, `Doc`).

**Navigation on click, not on drag end.** dnd-kit's activation constraint separates them.

## Remove (×) on hover — my recommendation: no

Three reasons:

1. **Mis-click risk.** A delete affordance under the cursor during dragging is dangerous.
2. **Rejected is a status, not a deletion.** The PRD's pipeline already has the "didn't work out" state.
3. **Touch has no hover.** A hover-only control is invisible on mobile — and you've confirmed responsive.

**Deletion belongs on the detail screen, behind the `⋯` menu, with confirmation.** Rare, deliberate, recoverable-feeling.

---

# 6 · DO YOU NEED LAZY LOADING? — no

You proposed per-column scrollbars with lazy loading. Let me check the numbers.

PRD: 20–50 applications per month. After **six months** at the high end: 300 applications, spread across six columns ≈ **50 per column**.

| Cards per column | DOM nodes | Verdict |
|---|---|---|
| 50 | ~350 | **Trivial.** Browsers handle thousands |
| 100 | ~700 | Still fine |
| 500+ | ~3,500 | Now consider virtualization |

**Virtualization is unnecessary for MVP**, and it actively conflicts with drag-and-drop — dragging toward a column edge needs auto-scroll, and virtualized lists make that fiddly.

**What you do need:**

```jsx
<div className="max-h-[calc(100vh-220px)] overflow-y-auto">
```

Native scroll, scrollbar appears only when content overflows — which is exactly the dynamic behaviour you described. Free, no library.

**Revisit at ~200 cards in one column.** If someone reaches that, they're a power user worth talking to anyway.

---

# 7 · SORT — and a better option than date

You suggested sort by date. Useful. But there's one more valuable for this specific product.

| Sort | Surfaces |
|---|---|
| Recently added | What you just did — the mockup's default |
| Date applied | Chronological order |
| Company A–Z | Finding a specific one |
| **Oldest activity first** | ⭐ **Applications going stale** |

**"Oldest activity first" is the one that matches the PRD's actual thesis.** Page 7: *"Without a tracker, they lose visibility into what's live, what's stale, and what needs a follow-up."*

Sorting by `last_activity_at ascending` puts the neglected applications at the top of each column — the ones where you applied 12 days ago and never followed up. That's the product working, not just a list being ordered.

**Schema:** `applications.last_activity_at TIMESTAMPTZ`, updated by any status change, call log, document, or note edit. One indexed column, and it makes the board diagnostic rather than merely organised.

---

# 8 · CONCURRENCY — the real question

Not dnd-kit's concern. Yours.

## The actual scenario

Same user, two browser tabs. Tab A drags a card to Interview. Tab B still shows it in Applied and drags it to Rejected. Which wins?

| Approach | Behaviour | Recommendation |
|---|---|---|
| **Last write wins** | Rejected wins, silently | ✅ **For MVP** |
| Optimistic locking | Version column; second write rejected with a conflict | Later, if it matters |

**Last-write-wins is correct here.** Both writes come from the same person; there's no data loss, just a status they can immediately correct. Optimistic locking adds a version column, conflict handling, and a UI state for "someone else changed this" — for a single-user resource.

**Revisit only if you add shared/team boards.**

## Optimistic update and rollback

```jsx
const move = async (id, from, to) => {
  setCards(prev => reposition(prev, id, to));        // instant
  try {
    const res = await fetch(`/api/applications/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', 'X-CSRF-Token': csrf },
      body: JSON.stringify({ status: to }),
    });
    if (!res.ok) throw new Error();
  } catch {
    setCards(prev => reposition(prev, id, from));    // snap back
    showError('Could not update — please try again');
  }
};
```

**The rollback is not optional.** Without it, a failed PATCH leaves the UI showing a status the database doesn't have — and the user believes it saved.

## Timeline events — debounce

Every status change writes to `application_events` (F2-1.3). Someone fidgeting a card between columns produces five timeline entries.

**Debounce 2s on the settled state.** Only the final position writes an event.

---

# 9 · YOUR SCALE — 10 users, 12 days

Let me actually compute it.

**Assumptions:** 10 free users, 12-day trial, 2 applications/day each.

| | Calculation | Result |
|---|---|---|
| Applications created | 10 × 2 × 12 | **240 total** |
| Per user | | **24** |
| Cards per column | 24 ÷ 6 | **~4** |
| Board load query | `WHERE user_id = $1` on ~24 rows | **< 3ms** |
| Status changes/day | ~4 per active user | **~40/day** |
| Drags per minute (all users) | 40 ÷ 1440 | **0.03/min** |
| Generations (40-cap trial) | 10 × 40 max, realistic ~25 each | **250–400 total** |

## What this means

**The board is not a load concern at any point in your first year.**

- **240 rows total.** Postgres returns this before the network round-trip finishes.
- **0.03 status updates per minute.** A single Postgres connection handles thousands per second.
- **Rendering ~4 cards per column.** Under 1ms.

**The one component that could genuinely queue is generation** — Gemini's per-minute burst limit (L034), which is why L091 put it behind a job queue. Not the board.

## At 1,000 users

Extrapolating (L033): ~2.5 writes/min, ~9 reads/min — **0.05% of a small Postgres instance.** The board's query is a single indexed lookup on `user_id`.

**Compute is not your constraint. It won't be for years.**

---

# 10 · IS dnd-kit RIGHT FOR YOU?

| Question | Answer |
|---|---|
| Secure? | Client-side only — no network, no eval, no storage. Nothing to attack |
| Works with Tailwind? | Yes — **it ships zero styling.** You supply every class |
| Lightweight? | ~6KB core + ~4KB sortable. Smaller than most icon sets |
| Conflicts with L020? | **No.** L020 bans *design systems* with baked-in visuals. dnd-kit is behaviour only — no components, no CSS |
| Handles concurrency? | **Wrong question** — it has no server component. See §8 |

**Use it.** Building drag from scratch means reimplementing keyboard sensors, ARIA live announcements, touch handling, collision detection, and auto-scroll. Weeks of work landing somewhere worse.

## Accessibility comes with it

```js
// Space starts drag · arrows move · Space drops · Escape cancels
useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
```

Plus ARIA live announcements on drag start, over, and end. **Building this yourself is the part that would actually take weeks.**

---

# 11 · IMPLEMENTATION CHECKLIST

- [ ] `PointerSensor` with `distance: 8` — separates click from drag
- [ ] `TouchSensor` with `delay: 200` — scroll vs drag on mobile
- [ ] `KeyboardSensor` — non-negotiable for accessibility
- [ ] `CSS.Translate.toString(transform)` — never animate `width`/`top`
- [ ] Optimistic move **with rollback on failure**
- [ ] Collapsed columns remain droppable
- [ ] Column collapse on **header** click only
- [ ] `overflow-y-auto` + `max-h` per column — no virtualization
- [ ] Timeline events debounced 2s
- [ ] `motion-reduce:transition-none`
- [ ] CSRF token on the PATCH
- [ ] `user_id` from session, never the request body

---

# 12 · SCHEMA ADDITION

```sql
ALTER TABLE applications
  ADD COLUMN last_activity_at TIMESTAMPTZ NOT NULL DEFAULT now();

CREATE INDEX idx_applications_board
  ON applications (user_id, status, last_activity_at DESC);
```

**One composite index serves the whole board** — filter by user, group by status, sort by activity. Enables the "oldest activity first" sort from §7.

**Update `last_activity_at` on:** status change · note edit · call log · document generated · reminder set.

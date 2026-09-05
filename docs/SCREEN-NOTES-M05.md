# SCREEN-NOTES-M05.md — Application detail

Pen source: `yYHoM` — "Mockup — 05 Application detail" · 1440×1040 · read 2026-08-26
Screen: `Mockup___05_Application_detail.png`

**Design intent from plate `Rzt0J` notes** (wireframe plate — notes only, styling ignored):

> *"One record, four surfaces. Overview, documents, calls and reminders are tabs on the same application rather than separate features."*
> *"The timeline is the answer to 'what happened with this one'. Every status change, generated document, logged call and sent follow-up writes one event."*
> *"Status changes from here and from the board drag. Both write the same timeline event — one code path, two entry points."*
> *"The right column is the action surface. Generation, call logging and reminders all start here because this is the screen the user is on when they remember."*

⚠️ **Tallest screen — 1040px.** The only one exceeding 900.

---

# 1 · LAYOUT

```
yYHoM   fill $m-bg · 1440×1040 · horizontal
├─ MTRv1  REF -> ErsAL (M/Sidebar)
└─ lLjhy  Main · vertical
   ├─ K8FDEU Top bar  fill $m-surface · border-bottom 1 · h 60 · pad [0,28] · gap 10
   └─ gpwPz  Body     pad [26,28] · gap 22 · vertical
      ├─ n5AmU4 Header  gap 10 · vertical
      └─ E1Fee  Columns gap 26 · horizontal
         ├─ cVj4C Left col   fill · gap 20 · vertical
         └─ imbCT Right col  w 236 fixed · gap 14 · vertical
```

⚠️ **Top bar is 60px here vs 68px on M03.** Detail is a slightly tighter chrome. Worth normalising to one value unless the designer intended the difference.

**Responsive:** right column stacks below the left under `lg`. It's the action surface, so on mobile it should sit **above** the timeline, not below — actions are why the user opened the screen.

---

# 2 · TOP BAR

## 2.1 · `BackLink` — `Qf9iN`

```
gap 6 · align center
  icon  lucide "arrow-left" 15×15 $m-ink-2
  text  "Board"  body 13/500  $m-ink-2
```

**Uses browser history**, not a hardcoded `/app/board` — the user may have arrived from List view or a reminder.

## 2.2 · `StatusChip` — `aWve1` ⚠️ interactive, colour-coded

```
fill $m-violet-soft · stroke $m-violet 1 · pad [8,12] · gap 8 · align center
  text  "Status: Interview"  body 12.5/600  $m-violet
  icon  lucide "chevron-down" 13×13  $m-violet
```

⚠️ **Fill and text both derive from the stage colour** — `$m-violet-soft` / `$m-violet` for Interview. Every `-soft` pair in the token set exists for exactly this.

```jsx
const soft = { saved:'muted', applied:'primary', assessment:'warning',
               interview:'violet', offer:'success', rejected:'danger' }[status];
<button className={`flex items-center gap-2 border px-3 py-2
                    bg-[--color-${soft}-soft] border-[--color-${soft}] text-[--color-${soft}]`}>
```

⚠️ **Tailwind cannot see dynamically-built class names.** Use a static map object, not template interpolation, or the classes get purged from the build.

**onClick** → dropdown of six stages.
**onChange** → `PATCH /api/applications/:id { status }` → **writes a timeline event**.
⚠️ **Designer's note 3: "Status changes from here and from the board drag. Both write the same timeline event — one code path, two entry points."** The service function is shared; only the caller differs.

## 2.3 · `OverflowMenu` — `rH2rY`

```
icon lucide "ellipsis" 19×19 $m-ink-2
```

**Contains delete** — per your decision, deletion lives here with confirmation, and **only when status is Rejected** (soft delete → trash → later hard delete).
Also: Edit, Duplicate.
**A11y** — `aria-label="More actions"`, `aria-haspopup="menu"`.

---

# 3 · HEADER

```
w00zD7  "Razorpay — Product Designer II"  display 22/600 · ls -0.3 · $m-ink
ufvf2   Chip row  gap 8 · align center
```

⚠️ **Title is `company — role`**, em dash separated. Both fields are user-supplied; the em dash is layout, so render them as separate spans rather than concatenating a string.

## 3.1 · Meta chips — `M/Tag` sized

```
fill $m-surface-2 · pad [5,10] · text mono 10.5/600 $m-ink-2
```

| Chip | Content | Derived from |
|---|---|---|
| `J25Bsg` | "Applied 12 Aug" | `date_applied` |
| `tEo7D` | "Source: LinkedIn" | ⚠️ **the `source` enum (L110)** |
| `b0aiFt` | "View posting" + external-link icon | `source_url` |

⚠️ **"Source: LinkedIn" is the third screen requiring the `source` enum** — after M03's filter and M04's missing input. It is displayed here and filtered there, but **collected nowhere**. That gap must close.

**"View posting"** → opens `source_url`.
⚠️ **`rel="noopener noreferrer"` + `target="_blank"`, and scheme allow-listed to `http`/`https`** (L110). This is the one place a user-supplied URL becomes a live link — the reverse-tabnabbing surface.

---

# 4 · LEFT COLUMN

## 4.1 · `Tabs` — `K88PM`

```
container  border-bottom $m-border 1
  SELECTED    border-bottom $m-primary 2 · pad [10,16] · text body 13/600 $m-ink
  UNSELECTED  pad [10,16] · text body 13/500 $m-muted
```

Four tabs: **Overview** · Documents 2 · Call log 1 · Reminders 1.

⚠️ **Counts are part of the label string** — "Documents 2", not a badge. Render as `{label} {count > 0 && count}`.

⚠️ **Three of four tabs belong to other features.** Per your decision they ship as **empty shells** in F2, filled by F3 (Documents), F5 (Call log), F4 (Reminders). Designer's note 1 agrees: *"Overview, documents, calls and reminders are tabs on the same application rather than separate features."*

**A11y** — `role="tablist"` · arrow-key navigation · `aria-selected` · `aria-controls`.
**Routing** — tab state in the URL (`?tab=documents`) so a tab is linkable and survives refresh.

## 4.2 · `JobDescriptionPanel` — `IKFwI`

```
fill $m-surface · stroke $m-border 1 · pad [16,18] · gap 12 · vertical
  Head   justify space-between · align center
    "JOB DESCRIPTION SNAPSHOT"  mono 10.5/600 · ls 0.8 · $m-ink-2
    Expand  gap 4 · text $m-accent body 12/600 + chevron-down 13 $m-accent
  body   body 13/normal · lh 1.6 · $m-ink-2   (truncated with "...")
```

⚠️ **Label says SNAPSHOT** — surfacing L090's copy-on-write to the user. The panel shows the JD *as used*, not the application's current text, when a snapshot exists.

**Expand** — accordion, not a modal. `aria-expanded` + `aria-controls`.
⚠️ **Line height 1.6** here vs 1.5 elsewhere — long-form reading.
**Security** — plain text, rendered as text. **Never `dangerouslySetInnerHTML`.** This field is user-pasted and is the prompt-injection vector from M04.

## 4.3 · `Timeline` — `N9VdT6` ⚠️ the product's memory

```
container  fill $m-surface · stroke $m-border 1 · vertical
Event      pad [13,16] · gap 12 · align center
           2nd onward: border-top $m-border 1
  icon box  fill $m-surface-2 · 26×26 · centred
    icon    lucide 14×14 — colour varies
  text      body 13/normal · $m-ink · fill
  date      mono 11.5/normal · $m-muted
```

### Event types — exact

| Icon | Colour | Example | Written by |
|---|---|---|---|
| `circle-dot` | **`$m-violet`** | "Status changed to Interview" | F2 status change |
| `phone` | `$m-primary` | "Call logged — salary discussed" | F5 |
| `mail` | `$m-primary` | "Follow-up email sent" | F4 |
| `file-text` | `$m-primary` | "Cover letter generated" | F3 |

⚠️ **The status-change icon takes the colour of the stage moved to** (`$m-violet` = Interview). Other events use `$m-primary`.

**Designer's note 2:** *"The timeline is the answer to 'what happened with this one'. Every status change, generated document, logged call and sent follow-up writes one event."*

**DB** — `application_events` (F2-1.3): `application_id`, `event_type`, `description`, `metadata JSONB`, `created_at`. **Append-only, never updated.**
⚠️ **Debounce status events 2s** — fidgety board drags otherwise produce five entries (`BOARD-COMPONENT.md` §8).
**A11y** — `<ol>`, semantically an ordered list.
**Empty state** — not drawn. A new application has one event ("Application added").

## 4.4 · `NotesField` — `gJICp`

```
label  "NOTES"  mono 10.5/600 · ls 0.8 · gap 8
Box    fill $m-surface · stroke $m-border 1 · pad [12,14] · h 70
  text body 13/normal · lh 1.5 · $m-ink-2
```

**Autosave on blur**, debounced. No Save button is drawn, so there must not be one.
**API** — `PATCH /api/applications/:id { notes }` → **updates `last_activity_at`** (board sort depends on it).
**DB** — `applications.notes TEXT`
**Security** — rendered as text, never HTML.

---

# 5 · RIGHT COLUMN — the action surface

Fixed 236px. Designer's note 4: *"Generation, call logging and reminders all start here because this is the screen the user is on when they remember."*

## 5.1 · `ActionButton` × 4

```
PRIMARY    fill $m-primary · stroke $m-primary 1 · pad [11,16] · gap 9 · icon 15 #FFF · text body 13/600 #FFF
SECONDARY  fill $m-surface · stroke $m-border-strong 1 · pad [11,16] · gap 9 · icon 15 $m-ink-2 · text body 13/600 $m-ink
```

| Button | Variant | Icon | Action |
|---|---|---|---|
| Generate cover letter | primary | `file-plus` | → M06 |
| Generate resume | primary | `file-plus` | → M06 |
| Log a call | secondary | `phone-call` | → F5 (plate 07) |
| Set a reminder | secondary | `bell-plus` | → F4 (plate 08) |

⚠️ **Fourth confirmation of `variant="secondary"`** — M01 SSO, M02 Back, M04 Cancel, M05 here. All `$m-surface` + `$m-border-strong`.

⚠️ **These carry icons; `M/Button`'s icon is disabled by default.** Same component, `icon` prop supplied. Padding `[11,16]` is a third size — normalise to `sm` `[10,18]` / `md` `[11,16]` / `lg` `[13,22]`.

### Generation buttons — quota states not drawn

Must reflect quota (L092, L109):

```jsx
<Button variant="primary" icon={FilePlus} fullWidth
        disabled={remaining === 0 || !profileComplete}
        onClick={() => router.push(`/app/applications/${id}/generate?type=cover`)}>
  Generate cover letter
</Button>
```

Three blocking conditions, none drawn:
- **Quota exhausted** → disabled + upgrade link
- **Profile incomplete** (L098) → disabled + "Complete your profile"
- **Email unverified** (L040) → disabled + "Verify your email"

**Never fail after the click** (N4.4).

## 5.2 · `LastCallPanel` — `iA9pY`

```
label  "FROM THE LAST CALL" + info icon
panel  fill $m-surface · stroke $m-border 1 · vertical
  Row  pad [12,14] · gap 5 · vertical   (2nd onward: border-top 1)
    key    body 12/normal   $m-muted
    value  body 13/600      $m-ink
```

| Key | Value |
|---|---|
| Salary | ₹32L fixed + ESOPs |
| Contact | Priya Nair, Talent Partner |
| Next step | Panel round — design exercise |

⚠️ **This is F5 data on an F2 screen.** Populated by the post-call log's AI extraction. **Empty until F5 ships** — needs an empty state that isn't drawn: *"No calls logged yet."*

**Semantically a `<dl>`** — `<dt>` key, `<dd>` value.
**DB** — `call_logs.extracted` JSONB, most recent by `created_at`.
⚠️ **AI-extracted values must be editable** (same principle as L049) — a wrong salary displayed as fact is worse than no salary.

---

# 6 · SCHEMA GAPS FOUND

| Field | Needed for | In `DATABASE.md`? |
|---|---|---|
| `source` enum | This screen's chip, M03's filter | ❌ **L110 decided, never added** |
| `assessment_due_at` | M03's `Due Fri` tag | ❌ |
| `interview_at` | M03's `Tue 3pm` tag | ❌ |
| `notes` | §4.4 | ❌ |
| `last_activity_at` | Board sort, updated here | ⚠️ decided in `BOARD-COMPONENT.md` §12, not in `DATABASE.md` |
| `application_events` | Timeline | ⚠️ task F2-1.3 exists, no DDL |

---

# 7 · WHAT'S NOT DRAWN

| | Task |
|---|---|
| Tab empty states — Documents 0, Call log 0, Reminders 0 | F2-3.19 |
| Timeline empty state | F2-3.18 |
| Last-call panel empty state | F2-3.20 |
| Generation button disabled states — 3 causes | F2-3.20 |
| Delete confirmation dialog | F2-3.20 |
| Notes saving indicator | F2-3.18 |
| Loading skeleton | F2-3.18 |

---

# 8 · OPEN

| | Question |
|---|---|
| 1 | **Top bar 60px here vs 68px on M03** — intentional, or normalise? |
| 2 | Are "Documents 2 / Call log 1 / Reminders 1" counts live, or fetched with the page? |
| 3 | Does Expand fetch the full JD, or is it already loaded and truncated by CSS? |
| 4 | Notes — autosave on blur confirmed? No Save button is drawn |
| 5 | Should the timeline paginate? A long-running application could reach 50 events |

---

# 9 · COMPONENT REUSE — running total

| Component | Status after M05 |
|---|---|
| `Button` | **3 sizes now** — `[10,18]` `[11,16]` `[13,22]`. Needs `size` + `variant` + `icon` |
| `Tag` | **3 sizes** — card 9.5 · meta 10.5 · skill |
| `StatusChip` | new — 6 colour variants from `-soft` pairs |
| `Tabs` | new |
| `Timeline` | new |
| `KeyValuePanel` | new — `<dl>` |
| `Accordion` | new — JD expand |
| `OverflowMenu` | new |

**`Button` is the highest-leverage component in the system** — four screens, three sizes, two variants, optional icon. Build it once, completely.

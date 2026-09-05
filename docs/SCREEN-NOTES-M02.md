# SCREEN-NOTES-M02.md — Profile builder

Pen source: `HTamK` — "Mockup — 02 Profile builder" · 1440×878 · read 2026-08-26
Screen: `Mockup___02_Profile_builder.png`

**Design intent from plate `nLoMc` notes** (wireframe plate — notes only, styling ignored):

> *"Two steps, not a wizard. Account details are step 1; everything generation-related is here in step 2."*
> *"Skippable, with a consequence. Users can reach the board immediately, but generation is blocked until target role, skills, and experience exist. The block explains which fields are missing."*
> *"Salary currency is explicit rather than inferred from locale — the target user is in India applying to international roles, so the two rarely match."*

**Every value below is read from source.** Tokens → `DESIGN-SYSTEM.md` §2.1. Interaction states → `INTERACTION-STATES.md`.

---

# 1 · LAYOUT

```
HTamK   fill $m-bg · vertical · 1440 wide
├─ rXQMe  Top bar   fill $m-surface · border-bottom $m-border · h 64 · padding [0,32]
└─ HUbuu  Body      padding [48,0,64,0]
   └─ skm6V  Form card  fill $m-surface · stroke $m-border 1 · padding 44 · w 720
```

```jsx
<div className="min-h-screen bg-[--color-bg]">
  <header className="flex h-16 items-center justify-between border-b border-[--color-border] bg-[--color-surface] px-8">
  <main className="px-4 pb-16 pt-12">
    <div className="mx-auto w-full max-w-[720px] border border-[--color-border] bg-[--color-surface] p-11">
```

**Responsive:** card is `max-w-[720px]`, full width below. The two-column rows (§3.3) collapse to single column under `sm`.

---

# 2 · TOP BAR

## 2.1 · `BrandMark` — reused from M01, smaller

| | M01 (auth) | M02 (app chrome) |
|---|---|---|
| Mark | 26×26 | **24×24** |
| Letter | display 13/700 | **display 12/700** |
| Wordmark | display 16/700 | **display 15/700** |

**One component, `size` prop.** Two hardcoded variants would drift.

## 2.2 · `StepChip` — `m2aZDx` → instance of `M/Tag`

```
ref: Ie19Q (M/Tag) · fill overridden to $m-primary-soft
```

Content "STEP 2 OF 2". Base `M/Tag` is `$m-surface-2`; here it's `$m-primary-soft` — **a state override, not a new component.** Build `Tag` with a `variant` prop.

## 2.3 · `SkipLink` — `OjdI5` ⚠️ built, hidden (L098)

```
gap 6 · text $m-ink-2 · body 13/500 "Skip for now"
icon lucide "arrow-right" 14×14 $m-ink-2
```

```jsx
{ALLOW_SKIP && (
  <button onClick={handleSkip}
          className="flex items-center gap-1.5 font-body text-[13px] font-medium
                     text-[--color-ink-2] hover:text-[--color-ink]">
    Skip for now <ArrowRight size={14} />
  </button>
)}
```

**onClick** → `/app/board` with the profile incomplete. **All AI actions disabled**, prompt shown naming the missing fields — your decision, and the designer's note agrees exactly.
**Refs** — T8.5 · L047 · L098 · plate `nLoMc` note 4

---

# 3 · FORM

## 3.1 · Heading

```
T9wE30  "Build your profile"  display 23/600  $m-ink
ZIvso   6px spacer
N1umgj  "Used to tailor every cover letter and resume. You can change it later."
        body 14/normal  $m-ink-2
kbuAw   30px spacer
UPkdC   Form  vertical  gap 22
```

**Form gap is 22px** — the rhythm between every field group.

## 3.2 · `ResumeDropzone` — `L0x6v`

```
Label   "BASE RESUME (OPTIONAL)"  mono 10.5/600  $m-ink-2
gap 8
Hatch   fill $m-bg · stroke $m-border-strong 1 · h 76 · gap 8 · centred
  icon  lucide "upload" 16×16 $m-muted
  text  "Drag a PDF or DOC here, or browse"  body 13/normal  $m-muted
```

⚠️ **The dropzone fill is `$m-bg`, not `$m-surface`** — inset against the white card. And `$m-border-strong`, not `$m-border`.

```jsx
<div className="flex flex-col gap-2">
  <label className="font-mono text-[10.5px] font-semibold uppercase tracking-[0.8px] text-[--color-ink-2]">
    Base resume <span className="text-[--color-muted]">(optional)</span>
  </label>
  <div onDrop={onDrop} onDragOver={e => e.preventDefault()}
       className="flex h-[76px] items-center justify-center gap-2
                  border border-[--color-border-strong] bg-[--color-bg]
                  hover:border-[--color-primary] hover:bg-[--color-primary-soft]">
    <Upload size={16} className="text-[--color-muted]" />
    <span className="font-body text-[13px] text-[--color-muted]">Drag a PDF or DOC here, or browse</span>
  </div>
  <input ref={fileRef} type="file" accept="application/pdf" className="sr-only" />
</div>
```

**⚠️ Design says "PDF or DOC". Our decision is PDF only** (L061 — Gemini native PDF vision). DOC would need conversion. **Copy must read "Drag a PDF here, or browse"** until DOC is supported.

**States** — idle · drag-over (`$m-primary` border) · uploading (spinner, "Reading your resume…") · error (`$m-danger` border, message below).
**onDrop → `POST /api/profile/parse-resume`** → fields populate, **stay editable** (L049). This *is* the review step.
**Validation** — client checks extension and size ≤10 MB. **Server checks magic bytes** (`SECURITY.md` G10) — client validation is UX only.
**Security** — file held in memory, sent to provider, **never written to disk or R2** (L064). Reject encrypted PDFs cleanly, don't crash (A10).

**Performance** — no client concern. The **endpoint** takes ~5s (Gemini vision). Concurrency handled by the job queue's rate limits (L034). One call per user, ever (L061).

**Refs** — T8.4 · T5.4 · L048→L061 · L049 · L064

## 3.3 · Field rows — all `M/Field` instances

```
CPdPh  Row name role       gap 20 · two × REF scDqq (fill_container)
W9L1hr Row exp target      gap 20 · two × REF scDqq
```

Four fields, all true `M/Field` instances: **Full name · Current role · Experience level · Target role.**

```jsx
<div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
  <Field id="full_name" label="Full name" … />
  <Field id="current_role" label="Current role" … />
</div>
```

⚠️ **`current_role` is L101** — added because this screen has it and the schema didn't.

⚠️ **Experience is a single `M/Field` in the design, but L107 decided years + months.** Two selects inside one field group:

```jsx
<div className="flex flex-col gap-[7px]">
  <label className="…uppercase…">Experience</label>
  <div className="flex gap-2">
    <select name="years">  {/* 0–60 */}  </select>
    <select name="months"> {/* 0–11 */}  </select>
  </div>
</div>
```

**This is a deliberate divergence from the mockup**, per your reasoning about Indian ATS conventions. Flag it to your designer.

**DB** — `profiles.full_name`, `current_role`, `years_experience`, `months_experience`, `target_role` (`DATABASE.md` §2.2)

## 3.4 · `SkillsTagInput` — `O0tzmQ`

```
Label  "SKILLS"  mono 10.5/600  $m-ink-2 · gap 7
Box    fill $m-surface · stroke $m-border 1 · padding [10,12] · gap 8 · horizontal
  Skill chip  fill $m-surface-2 · padding [5,10] · gap 6
    text  mono 10.5/600  $m-ink-2
    icon  lucide "x" 11×11  $m-muted
  placeholder  "Add a skill…"  body 13/normal  $m-muted
```

⚠️ **Chips here differ from `M/Tag`** — `M/Tag` has gap 5 and no icon; these have gap 6 and an 11px `x`. **A `Tag` with a `removable` prop**, not a separate component.

**React** — Enter or comma commits · Backspace on empty removes the last · **lowercase-normalise on commit** (L045) · dedupe silently · chips wrap to multiple lines.

**A11y** — the remove control is a `<button aria-label="Remove Figma">`, never a bare icon. Container is `role="list"`, chips `role="listitem"`.

**DB** — `profiles.skills TEXT[]` (L045)
**Refs** — T8.5 · L045 · `DATABASE.md` §2.2

## 3.5 · `SalaryField` — `sECRk` ⚠️ composite

```
Label     "SALARY EXPECTATION"  mono 10.5/600 · gap 7
Salary row  horizontal
  Currency  fill $m-surface-2 · stroke $m-border 1 · padding [11,10] · gap 4 · w 74
    text  "INR"  body 13/600  $m-ink
    icon  lucide "chevron-down" 13×13  $m-muted
  Amount    fill $m-surface · stroke $m-border · padding [11,13] · fill_container
    text  "28,00,000 / year"  body 13.5/normal  $m-ink
```

⚠️ **Currency has a different fill (`$m-surface-2`) from the amount input (`$m-surface`)** — a deliberate visual grouping. Fixed 74px, amount fills.

⚠️ **Designer's note: "Salary currency is explicit rather than inferred from locale — the target user is in India applying to international roles, so the two rarely match."** Never geo-detect this.

**Where's the period?** The mockup shows `28,00,000 / year` as one string. `DATABASE.md` has `salary_period` as a separate enum. **Either the period is a third control, or "/ year" is a suffix with monthly unsupported.** Needs a decision — the `salary_complete` CHECK constraint requires all three or none.

**Format** — Indian grouping (`28,00,000`) not Western (`2,800,000`). `Intl.NumberFormat('en-IN')`.
**DB** — `salary_amount NUMERIC(12,2)` · `salary_currency CHAR(3)` · `salary_period` enum

## 3.6 · `LocationSegmented` — `dNka0`

```
Label  "LOCATION PREFERENCE"  mono 10.5/600 · gap 7
Row    gap 8 · h 38
  Remote   fill $m-primary · stroke $m-primary · padding [8,14] · text #FFF body 12.5/600
  Hybrid   fill $m-surface · stroke $m-border-strong · text $m-ink-2 body 12.5/600
  On-site  fill $m-surface · stroke $m-border-strong · text $m-ink-2 body 12.5/600
```

**Selected = `$m-primary` fill + white text. Unselected = `$m-surface` + `$m-border-strong`.** The clearest selected-state definition in the whole file — reuse this pattern for every segmented control (Board/List toggle, document type).

```jsx
<div role="radiogroup" aria-label="Location preference" className="flex gap-2">
  {['remote','hybrid','onsite'].map(v => (
    <button key={v} role="radio" aria-checked={value === v} onClick={() => onChange(v)}
            className={`px-[14px] py-2 font-body text-[12.5px] font-semibold border ${
              value === v
                ? 'bg-[--color-primary] border-[--color-primary] text-white'
                : 'bg-[--color-surface] border-[--color-border-strong] text-[--color-ink-2]'}`}>
      {label[v]}
    </button>
  ))}
</div>
```

**A11y** — `role="radiogroup"` with arrow-key navigation. Three buttons alone are not equivalent.
**DB** — `location_preference` enum `remote|hybrid|onsite` (L102)

## 3.7 · Actions — `bxS7n`

```
34px spacer · Divider $m-border 1px · 22px spacer
Actions  gap 12
  Back  fill $m-surface · stroke $m-border-strong 1 · padding [13,22] · body 13.5/600 $m-ink
  Save  REF zK0k4 (M/Button)
```

⚠️ **`Back` is a secondary button** — `$m-surface` + `$m-border-strong`, same treatment as the SSO buttons in M01. **Add `variant="secondary"` to `Button`**; it appears on at least two screens.

**Save** → `PUT /api/profile`, then `/app/board`. Sets `completed_at` when the minimum fields exist (T5.6).
**Dirty-state warning on navigate away** — this form is long.

---

# 4 · WHAT'S NOT DRAWN

| | Why needed | Task |
|---|---|---|
| **Field error states** | No validation styling anywhere | `INTERACTION-STATES.md` §4 |
| **Upload progress** | ~5s parse with no feedback | T8.4 |
| **Parse failure** | Form must stay usable for manual entry | T8.4 |
| **"Skip" consequence prompt** | The board needs to explain which fields block generation | T8.5, L098 |
| **Required-field marks** | Which of these are mandatory for `completed_at`? | T5.6 |

---

# 5 · OPEN

| | Question |
|---|---|
| 1 | **Salary period** — mockup shows "/ year" inline; schema has a separate enum. Third control, or year-only? Blocks the `salary_complete` CHECK |
| 2 | **"PDF or DOC"** — we support PDF only (L061). Copy must change, or DOC needs conversion |
| 3 | **Which fields set `completed_at`?** Designer's note says target role, skills, experience. Full name too? |
| 4 | Experience as years+months diverges from the mockup's single field (L107) — tell the designer |

---

# 6 · COMPONENT REUSE FROM M01

| Component | Change |
|---|---|
| `BrandMark` | smaller — needs a `size` prop |
| `Field` | unchanged, 4 instances |
| `Button` primary | unchanged (Save) |
| `Button` secondary | **new variant** — Back. Same treatment as M01's SSO buttons |
| `Tag` | **new `removable` variant** — skill chips |

**Running total after two screens: 5 primitives, 2 needing variant props.** The inventory is converging.

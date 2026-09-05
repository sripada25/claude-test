# SCREEN-SPEC-M02.md — Profile builder

Full operational specification. Same depth as `SCREEN-SPEC-M01.md`, confirmed format.

**Sources merged:** `SCREEN-NOTES-M02.md` (pen values) · `TASKS-FRONTEND_quarterfinal.md` M02 section · `INTERACTION-STATES.md` (corrected 2026-08-27 — real focus/disabled/error values) · `DATABASE_quarterfinal.md` (schema) · `DECISIONS_quarterfinal.md` L101, L102, L107

One open item resolved here that wasn't in the screen notes: the salary period control. See the Salary field section below.

---

# SCREEN

**Mockup:** `Mockup___02_Profile_builder.png` · pen source `HTamK`
**Route:** `/app/profile`
**GitHub Issue:** (create per `ISSUES.md` before branching)

---

# RESOLUTION

## Breakpoints

| Breakpoint | Width | Card / form behavior |
|---|---|---|
| Mobile | < 640px | Card full width minus margins, padding drops [44,40] to [20,16] |
| sm | greater than or equal to 640px | Two-column field rows (name/role, years/months+target) return |
| md+ | greater than or equal to 768px | No further change - card stays max-w-[720px], centred |

## Screen resolution - browser

Design canvas: 1440x878. Card is centred, max-w-[720px], everything outside it is $m-bg.

## Tablet resolution

768-1023px: identical to desktop - same 720px card, same two-column rows. No tablet-specific behavior exists in the source.

## Mobile resolution

Less than 640px: grid-cols-2 becomes grid-cols-1 on every field row (confirmed in SCREEN-NOTES-M02.md section 3.3). Years/months selects stay side-by-side even at mobile width - they're two narrow selects, not a full field row, so they don't need the stacking rule.

## Screen background

bg-[--color-bg] (#F5F3EF), same as M01. Top bar is $m-surface (white) with a bottom border, distinct from the page background.

```jsx
<div className="min-h-screen bg-[--color-bg]">
  <header className="flex h-16 items-center justify-between border-b border-[--color-border] bg-[--color-surface] px-8">
```

---

# TASKS LIST

| Task ID | Component |
|---|---|
| M02-01 | StepChip |
| M02-02 | SkipLink (built, hidden) |
| M02-03 | ResumeDropzone |
| M02-04 | ProfileFields (name, role, experience, target role) |
| M02-05 | SkillsTagInput |
| M02-06 | SalaryField |
| M02-07 | LocationSegmented |
| M02-08 | ProfileActions (Back, Save) |

Backend dependencies: T5.4 parse-resume, T5.5 GET/PUT profile, T5.6 completeness rule, T1.3 the profiles migration itself.

---

# DATABASE SCHEMA - every write this screen produces

| Field on screen | Table.column | Type |
|---|---|---|
| Full name | profiles.full_name | TEXT |
| Current role | profiles.current_role | TEXT (L101) |
| Experience - years | profiles.years_experience | SMALLINT 0-60 (L107) |
| Experience - months | profiles.months_experience | SMALLINT 0-11 (L107) |
| Target role | profiles.target_role | TEXT |
| Skills | profiles.skills | TEXT[], lowercase (L045) |
| Salary amount | profiles.salary_amount | NUMERIC(12,2) |
| Salary currency | profiles.salary_currency | CHAR(3) |
| Salary period | profiles.salary_period | ENUM - see Salary section below |
| Location preference | profiles.location_preference | ENUM remote/hybrid/onsite (L102) |
| (system-set) | profiles.completed_at | TIMESTAMPTZ, set by T5.6's rule, not entered directly |

Full reference: DATABASE_quarterfinal.md section 2.2.

---

# API CALLS

| Trigger | Endpoint | Method |
|---|---|---|
| Resume dropped on the dropzone | /api/profile/parse-resume | POST - returns data, saves nothing |
| Save & continue clicked | /api/profile | PUT |
| (Skip, if unhidden) | none | client-side navigation only |

---

# ON SUCCESS

```
Resume parse success
   |
   Form fields populate with extracted data
   |
   User reviews/edits (mandatory step, L049)
   |
   (screen stays here - no navigation yet)

Save & continue success
   |
   PUT /api/profile succeeds
   |
   Server computes completed_at (T5.6: set if target_role,
   skills, and experience are all present - see Required fields below)
   |
   -> /app/board
```

Resume parsing never navigates anywhere. It only fills the form in place - the user must still click Save. This is the entire point of L049's mandatory review.

---

# REQUIRED FIELDS - resolving M02's open item #3

SCREEN-NOTES-M02.md section 5 left this open. Resolving it here from the designer's note plus product logic:

| Field | Required for completed_at? | Why |
|---|---|---|
| Full name | Yes | Appears on every generated document - a cover letter needs a signoff name |
| Target role | Yes - designer's note names it explicitly | Directly drives generation prompts |
| Skills | Yes - designer's note names it explicitly | Directly drives generation prompts |
| Experience (years+months) | Yes - designer's note names it explicitly | Directly drives generation prompts |
| Current role | No | Contextual, not essential to a first generation |
| Salary | No | Never required by the PRD; purely informational for the user's own tracking |
| Location preference | No | Same |

T5.6's rule: completed_at is set when full_name, target_role, skills (non-empty array), years_experience, and months_experience are all present. The other three fields can be blank and generation still works.

---

# SALARY PERIOD - resolving M02's open item #1

The mockup shows "28,00,000 / year" as one string. The schema keeps salary_period as a real column (confirmed - this was never dropped despite the mockup's single-string appearance). That means a control must exist that the mockup doesn't draw.

Resolution: add a small period toggle, reusing the exact LocationSegmented selected/unselected pattern already established as the file's standard (SCREEN-NOTES-M02.md section 3.6):

```jsx
<div className="flex items-center gap-2">
  <div className="flex w-[74px] items-center gap-1 border border-[--color-border]
                  bg-[--color-surface-2] px-[10px] py-[11px]">
    <span className="font-body text-[13px] font-semibold text-[--color-ink]">INR</span>
    <ChevronDown size={13} className="text-[--color-muted]" />
  </div>
  <input className="flex-1 border border-[--color-border] bg-[--color-surface] px-[13px] py-[11px]
                    font-body text-[13.5px] text-[--color-ink]" placeholder="28,00,000" />
  <div role="radiogroup" className="flex gap-1">
    {['monthly','annual'].map(p => (
      <button key={p} role="radio" aria-checked={period === p}
              className={cn('px-3 py-2 font-body text-[12px] font-semibold border',
                period === p
                  ? 'bg-[--color-primary] border-[--color-primary] text-white'
                  : 'bg-[--color-surface] border-[--color-border-strong] text-[--color-ink-2]')}>
        {p === 'monthly' ? '/mo' : '/yr'}
      </button>
    ))}
  </div>
</div>
```

Flag to the designer - this is our addition, not a pen-verified layout. Added to DESIGN-BRIEF.md.

---

# FRONTEND COMPONENT REFERENCE

- 1 container - the form card, static (no mode-switching, unlike M01)
- 1 status chip - StepChip
- 1 optional link - SkipLink (built, hidden per L098)
- 1 file dropzone - ResumeDropzone
- 4 field instances - Full name, Current role, Target role (Field), plus the composite Experience group
- 1 tag input - SkillsTagInput
- 1 composite field - SalaryField (currency + amount + period, three controls)
- 1 segmented control - LocationSegmented
- 2 action buttons - Back (secondary), Save (primary)

No tabs, no accordion - everything is visible on one scroll.

---
---

# COMPONENT-BY-COMPONENT

## StepChip

Content: "STEP 2 OF 2" - mono 10.5/600 - letterSpacing 0.5 - fill $m-primary-soft, text $m-primary.
No interaction - purely informational, not clickable.

---

## SkipLink (built, hidden)

Tailwind: flex items-center gap-1.5 font-body text-[13px] font-medium text-[--color-ink-2]

onHover: text-[--color-ink-2] to text-[--color-ink], transition-colors duration-150.

onClick (when unhidden): navigates to /app/board with the profile incomplete. Does not call any API - it's a plain client-side navigation; completed_at simply stays NULL because nothing was saved.

Consequence on the board: every AI action (generate buttons on M05/M06) renders disabled, with copy naming the specific missing fields (per L098 and the designer's matching note).

---

## ResumeDropzone

Tailwind (idle):
```
flex h-[76px] items-center justify-center gap-2
border border-[--color-border-strong] bg-[--color-bg]
```

onDragOver: border and background shift - border-[--color-primary] bg-[--color-primary-soft]. transition-colors duration-150.

onDrop: immediately shows an uploading state - spinner + "Reading your resume..." replaces the idle content. POST /api/profile/parse-resume fires.

onClick (anywhere in the box, not just drag): opens the native file picker - the same visible input type="file" stays in the DOM as sr-only, so both mouse-drag and keyboard/click work.

onSuccess (parse): fields below populate with extracted values. The dropzone itself returns to idle - it doesn't show a "success" state permanently, since the success is reflected in the now-filled form, not the dropzone.

onError (parse failure):
```
border-[--color-danger]
```
Message below: "Couldn't read that file - try again, or fill in your details manually." Form remains fully usable either way - this is not a blocking failure.

onFocus (keyboard): the hidden file input receives the corrected focus ring (ring-2 ring-inset ring-[--color-primary] on the visible dropzone box, since the actual input is invisible).

Input data sent to: nowhere directly - this endpoint returns JSON, it does not write to any table. The returned values populate the form's local state; only a subsequent Save writes to profiles.

Security: file held in memory server-side, sent to Gemini, discarded. Never touches disk or R2. Magic-byte validation server-side; the accept="application/pdf" on the input is a UX hint only, not a security control.

---

## Full name / Current role / Target role - Field instances

Identical mechanics to M01's EmailField, corrected for the verified interaction states:

```jsx
<input className="w-full border border-[--color-border] bg-[--color-surface] px-[13px] py-[11px]
                    font-body text-[13.5px] text-[--color-ink]
                    focus:border-[--color-primary]
                    focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[--color-primary]
                    aria-[invalid=true]:border-[1.5px] aria-[invalid=true]:border-[--color-danger]" />
{error && (
  <div className="flex items-center gap-[5px]">
    <CircleAlert size={12} className="text-[--color-danger]" />
    <p className="font-mono text-[10.5px] text-[--color-danger]">{error}</p>
  </div>
)}
```

onError copy, per field:
- Full name: "Enter your name"
- Target role: "Enter the role you're targeting"
- Current role: no error - it's optional, never validated as required

Input data sent to: profiles.full_name, profiles.current_role, profiles.target_role respectively, via the PUT /api/profile body - not on every keystroke, only on Save.

---

## Experience - years + months (two selects, diverges from the mockup)

Two native select elements, side by side, sharing one label:

```jsx
<div className="flex flex-col gap-[7px]">
  <label className="font-mono text-[10.5px] font-semibold uppercase tracking-[0.8px] text-[--color-ink-2]">
    Experience
  </label>
  <div className="flex gap-2">
    <select aria-label="Years of experience" className="…">
      {Array.from({length: 61}, (_, i) => <option key={i} value={i}>{i} yr</option>)}
    </select>
    <select aria-label="Months of experience" className="…">
      {Array.from({length: 12}, (_, i) => <option key={i} value={i}>{i} mo</option>)}
    </select>
  </div>
</div>
```

onChange (either select): updates local state immediately - no async call, this is a plain controlled select.

onFocus: native browser select focus ring applies; we don't override select focus styling beyond what the browser gives, since custom-styling native selects breaks platform-native keyboard behavior (arrow keys to cycle options).

No error state - both default to 0, which is always a valid value, so there's nothing to reject.

Input data sent to: profiles.years_experience, profiles.months_experience - two separate integer columns.

---

## SkillsTagInput

Tailwind (container):
```
flex flex-wrap items-center gap-2 border border-[--color-border] bg-[--color-surface] px-[12px] py-[10px]
```

onKeyDown (Enter or comma): commits the current text as a chip. Text is lowercased and trimmed before committing. If the resulting string already exists among the current chips, nothing is added (silent dedupe - no error shown, since a duplicate skill isn't a mistake worth interrupting the user over).

onKeyDown (Backspace on empty input): removes the last chip in the list.

Chip onClick (the x icon specifically):
```jsx
<button aria-label={`Remove ${skill}`} onClick={() => removeSkill(skill)}
        className="text-[--color-muted] hover:text-[--color-danger] transition-colors duration-150">
  <X size={11} />
</button>
```

onFocus (the text input within): ring-2 ring-inset ring-[--color-primary] on the outer container, not just the invisible text input - so the whole field reads as focused, not just a thin cursor.

Input data sent to: profiles.skills TEXT[] - the full array, replacing whatever was there, sent as part of the PUT /api/profile body.

---

## SalaryField (composite - currency, amount, period)

Currency selector onClick: opens a small native select styled to match (INR only in MVP - no other currencies drawn or needed for the target market, per the designer's note about not geo-inferring).

Amount input:
```
type="text" inputMode="numeric"
```
Not type="number" - Indian digit grouping (28,00,000) isn't representable by a native number input, which would strip the commas. Formatting is applied via Intl.NumberFormat('en-IN') on blur, and raw digits are parsed back out on submit.

onBlur (amount): reformats the displayed value with Indian grouping. onFocus (amount): reverts to a plain unformatted number for easier editing, then reformats again on blur.

Period toggle onClick: switches between monthly and annual, using the same selected/unselected treatment as LocationSegmented.

onError (the group as a whole): if amount is filled but currency or period is somehow missing (shouldn't happen with real UI, but defensively): "Complete all three - amount, currency, and period - or leave salary blank."

Input data sent to: profiles.salary_amount, salary_currency, salary_period - all three together or none, matching the salary_complete database CHECK constraint exactly. The frontend should never submit a partial triple.

---

## LocationSegmented

Fully specified already in SCREEN-NOTES-M02.md section 3.6 - reproduced with corrected focus:

```jsx
<button role="radio" aria-checked={value === v} onClick={() => onChange(v)}
        className={cn('px-[14px] py-2 font-body text-[12.5px] font-semibold border',
          'focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[--color-primary]',
          value === v
            ? 'bg-[--color-primary] border-[--color-primary] text-white'
            : 'bg-[--color-surface] border-[--color-border-strong] text-[--color-ink-2]')}>
```

onClick: immediate visual selection, no confirmation needed - this is a simple preference toggle, not a destructive action.

Input data sent to: profiles.location_preference enum.

---

## Back button

onClick: navigates to the previous step (account creation / M01), with a dirty-state check - if any field has been touched, confirm before leaving.

Tailwind: secondary treatment, identical to M01's SSO buttons - bg-[--color-surface] border border-[--color-border-strong].

---

## Save & continue button

onClick: validates required fields client-side first (see Required Fields section above), then PUT /api/profile with the full form body.

Loading state: disables, shows spinner, aria-busy="true" - identical pattern to M01's SignInButton.

onError (server rejects, e.g. a constraint violation): form-level banner above the fields: "Something went wrong saving your profile - please try again." Field-level errors (missing required field) are caught client-side before this call even fires, so a server-side validation error here should be rare.

onSuccess: navigates to /app/board per the OnSuccess table above.

---
---

# WHAT'S STILL NOT DRAWN - carried from SCREEN-NOTES-M02.md section 4, now with resolutions

| | Resolution |
|---|---|
| Field error states | Resolved - INTERACTION-STATES.md section 4, applied above |
| Upload progress | Specified above - spinner + "Reading your resume..." |
| Parse failure | Specified above - form stays usable |
| "Skip" consequence prompt | Still needs actual copy/design on the board side - not this screen's concern |
| Required-field marks | Resolved above - full name, target role, skills, experience |

---

# CONFIRM BEFORE M03

Same question as M01: is this the right depth? If so, M03 (Pipeline board) is next - it's the largest of the six screens (13 components in the inventory), so expect a correspondingly longer document.

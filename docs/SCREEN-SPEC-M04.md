# SCREEN-SPEC-M04.md — Add application drawer

Full operational specification. Same depth and format as M01-M03.

Sources merged: SCREEN-NOTES-M04.md (pen values) · TASKS-FRONTEND_quarterfinal.md M04 section · SECURITY_quarterfinal.md section 13 (prompt injection) · AI-RULES.md section 2.1 · INTERACTION-STATES.md (corrected) · DATABASE_quarterfinal.md section 3.1 · DECISIONS_quarterfinal.md L090, L091, L092, L103, L110, L114

Two things resolved here that were open in the screen notes: the missing Source field (L114), and the prompt-injection defence this screen is the entry point for.

---

# SCREEN

Mockup: Mockup___04_Add_application.png · pen source s6PJO
Route: overlay on /app/board — not its own route (opens as a drawer, board stays mounted behind it)
GitHub Issue: (create per ISSUES.md before branching)

---

# RESOLUTION

## Breakpoints

| Breakpoint | Width | Drawer behavior |
|---|---|---|
| Mobile | < 768px | Drawer becomes full-screen, slides from the bottom instead of the right |
| md | greater than or equal to 768px | Drawer returns to fixed 410px, slides from the right |
| lg+ | greater than or equal to 1024px | No further change |

Warning: 410px on a 375px phone viewport is wider than the screen itself — this is why full-screen below md is not optional, it is required for the drawer to fit at all.

## Screen resolution - browser

Design canvas: 1440x900. Drawer is 410px fixed, right-aligned, full height. Board behind it is dimmed (opacity 0.45), not covered by a separate backdrop element in the source - see Drawer component notes below for why we add one anyway.

## Tablet resolution

768-1023px: drawer behavior matches desktop - 410px, right-aligned. The compressed board columns seen in the mockup (178px instead of 200px) are a design-time visual artifact only; in code the board simply reflows around the drawer's width, never hardcoded to two different column widths.

## Mobile resolution

Less than 768px: full-screen drawer, slides from the bottom. Header, form, and actions stack the same way; only the container changes from a right-side panel to a full-screen sheet.

## Screen background

Drawer: bg-[--color-surface] (white). Board behind it: bg-[--color-bg] at 45% opacity via the dimming treatment, not a separate overlay color.

```jsx
<div className="fixed inset-0" onClick={requestClose} aria-hidden />
<aside role="dialog" aria-modal="true" aria-labelledby="drawer-title"
       className="fixed inset-y-0 right-0 z-50 flex w-full flex-col justify-between
                  border-l border-[--color-border] bg-[--color-surface]
                  md:w-[410px]">
```

Warning: the backdrop div above does not exist in the pen source - the dim is applied to the board itself. We add a real backdrop element for click-outside-to-close, per your confirmed decision.

---

# TASKS LIST

| Task ID | Component |
|---|---|
| M04-01 | Drawer (container, focus trap, backdrop) |
| M04-02 | DrawerHeader (title, close) |
| M04-03 | ApplicationFields (company, role, status, date, source URL, Source dropdown) |
| M04-04 | JobDescriptionField (textarea, counter, snapshot note) |
| M04-05 | GenerateCheckbox |
| M04-06 | DrawerActions (Cancel, Save) |

Backend dependencies: F2-2.1 create · F2-1.2 source enum · F2-2.9 URL validation · F3-3.1 generate endpoint (if checkbox ticked) · F3-2.5 quota decrement.

---

# DATABASE SCHEMA - every write this screen produces

| Field on screen | Table.column | Type | Required? |
|---|---|---|---|
| Company | applications.company | TEXT | Yes |
| Role | applications.role | TEXT | Yes |
| Status | applications.status | ENUM, default 'saved' | No - has a default |
| Date applied | applications.date_applied | DATE | No |
| Source | applications.source | ENUM (L110) | No |
| Source URL | applications.source_url | TEXT | No |
| Job description | applications.job_description | TEXT, CHECK less than or equal to 15000 chars (L103) | No |
| Generate checkbox (if ticked) | triggers F3-3.1, not a column itself | - | - |

Full reference: DATABASE_quarterfinal.md section 3.1.

---

# API CALLS

| Trigger | Endpoint | Method |
|---|---|---|
| Save application clicked | /api/applications | POST |
| (if Generate checked) after save succeeds | /api/applications/:id/generate | POST |
| Cancel / backdrop click / Escape | none | client-side close only |

---

# ON SUCCESS

```
Save clicked, validation passes
   |
   POST /api/applications -> 201 immediately (L091 - never blocks on generation)
   |
   Drawer closes
   |
   Card appears on the board in its assigned status column
   |
   IF Generate was checked:
        generation job enqueued in the background
        |
        detail screen (if user navigates there) shows "Generating..."
        |
        card gains a "Doc" tag once generation completes

Cancel clicked (form has unsaved input)
   |
   Confirm dialog: "Discard this application?"
   |
   Confirm -> drawer closes, nothing saved
   Cancel  -> stays on the form

Cancel clicked (form is empty/untouched)
   |
   Drawer closes immediately, no confirmation needed
```

Warning: the drawer never navigates to a new route on success - the user stays on the board, sees the new card appear. Only clicking the card afterward takes them to M05.

---

# FRONTEND COMPONENT REFERENCE

- 1 container - Drawer, with a backdrop we add (not pen-drawn)
- 1 header - title + close icon
- 6 field instances - Company, Role, Status, Date applied, Source, Source URL (5 are true M/Field instances, Source is new)
- 1 custom field - JobDescriptionField (label row carries a character counter, same labelAction pattern as M01's password field)
- 1 checkbox row - GenerateCheckbox with dynamic label text
- 2 action buttons - Cancel (secondary), Save (primary)

---
---

# COMPONENT-BY-COMPONENT

## Drawer (container)

Tailwind: see Screen background above.

onOpen: focus moves to the first field (Company). Body scroll is locked on the underlying page.

onClose (any method - X, Cancel, Escape, backdrop): if the form has any input, confirm before closing (see OnSuccess above). If empty, close immediately.

onKeyDown (Escape anywhere in the drawer): triggers the same close-with-confirmation logic as clicking X.

A11y: role="dialog" aria-modal="true" aria-labelledby pointing at the title. Focus is trapped inside the drawer - Tab cycles through drawer elements only, never escapes to the board behind it. On close, focus returns to the "Add application" button that opened it.

---

## DrawerHeader

Tailwind: flex items-center justify-between border-b border-[--color-border] px-7 py-5

Title: "Add application" - display 19/600, letterSpacing -0.2, $m-ink.

Close icon onClick: same close-with-confirmation logic as above.
Close icon onHover: text-[--color-muted] to text-[--color-ink-2].
Close icon onFocus: ring-2 ring-inset ring-[--color-accent] (buttons/icon-buttons use accent per verified source). Touch target padded to 44x44 even though the visible icon is 18px.

---

## Company / Role - Field instances

Identical mechanics to every other Field instance in the system (see M01 EmailField, M02 ProfileFields for the full pattern). Corrected interaction states applied:

```jsx
className="w-full border border-[--color-border] bg-[--color-surface] px-[13px] py-[11px]
           font-body text-[13.5px] text-[--color-ink]
           focus:border-[--color-primary]
           focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[--color-primary]
           aria-[invalid=true]:border-[1.5px] aria-[invalid=true]:border-[--color-danger]"
```

onError:
- Company: "Enter the company name"
- Role: "Enter the role"

Both are the only two required fields on this entire form - designer's note: "a tracker that refuses partial records doesn't get used during a burst of applying." Resist adding validation beyond these two.

Input data sent to: applications.company, applications.role.

---

## Status - Select

Native select, options are the six stage enum values, default "saved" pre-selected.

onChange: updates local state, no async call until Save.

Input data sent to: applications.status.

---

## Date applied - Date picker

Native date input or a custom picker matching the field box styling.

onFocus: same ring-2 ring-inset ring-[--color-primary] as every other field.

Open question carried from the screen notes: does this default to today's date, or stay empty? If status defaults to "saved" (not yet applied), a pre-filled today's date is misleading. Recommendation: leave empty by default, since "saved" and "applied" are different moments.

Input data sent to: applications.date_applied. Optional - NULL is valid.

---

## Source - new field, resolving the open gap (L114)

This field does not exist in the original mockup. It is required because the pipeline board's Source filter (M03) and the application detail screen's "Source: LinkedIn" chip (M05) both need a value that nothing previously collected.

```jsx
<Field id="source" label="Source" as="select" value={source} onChange={setSource}>
  <option value="">Select source</option>
  <option value="linkedin">LinkedIn</option>
  <option value="naukri">Naukri</option>
  <option value="indeed">Indeed</option>
  <option value="referral">Referral</option>
  <option value="company_site">Company site</option>
  <option value="other">Other</option>
</Field>
```

onBlur (of the Source URL field, see below): if Source URL contains a recognizable domain (linkedin.com, naukri.com, indeed.com), auto-select the matching Source option. User can still override it manually - this is a convenience pre-fill, never a locked value.

Input data sent to: applications.source enum. Optional.

---

## Source URL - Field instance with security notes

Same Field mechanics as Company/Role, but with real security handling on the value:

Warning, security: scheme allow-list enforced. Accepts only http:// and https://. Rejects javascript:, data:, file:, vbscript: schemes at validation time, before the value is ever saved.

Warning, security: this URL is never fetched server-side, anywhere, at any point (L081, the SSRF decision). It is stored and displayed only. Rendered later on M05 as a link with rel="noopener noreferrer" and target="_blank".

onError: "Enter a valid web address" - shown if the scheme check fails.

Input data sent to: applications.source_url. Optional.

---

## JobDescriptionField - custom, not a plain Field instance

Same reasoning as M01's password field and M02's dropzone label: the label row carries a live character counter, so this cannot be a plain Field instance. Reuses the labelAction slot pattern established there.

```jsx
<div className="flex w-full flex-col gap-2">
  <div className="flex items-center justify-between">
    <label htmlFor="jd" className="font-mono text-[10.5px] font-semibold uppercase tracking-[0.8px] text-[--color-ink-2]">
      Job description
    </label>
    <span className={count > 13500 ? 'text-[--color-danger]' : 'text-[--color-muted]'}
          aria-live="polite">
      {count.toLocaleString('en-IN')} / 15,000
    </span>
  </div>
  <textarea id="jd" maxLength={15000} rows={6}
            onChange={e => setJd(e.target.value)}
            className="h-[118px] w-full resize-y border border-[--color-border] bg-[--color-surface]
                       px-[13px] py-[11px] font-body text-[12.5px] leading-[1.5] text-[--color-ink]
                       focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[--color-primary]" />
  <p className="font-body text-[11.5px] leading-[1.5] text-[--color-muted]">
    Stored as a snapshot - later edits to the posting won't change what was used.
  </p>
</div>
```

onChange: counter updates live, turns red past 90% of the limit. maxLength enforces the cap client-side; the database CHECK constraint is the authoritative limit, not this attribute.

onFocus: ring-2 ring-inset ring-[--color-primary] on the textarea itself.

### This is the prompt-injection entry point for the entire product

The text entered here is later sent, unmodified by the user's intent but very much modified by our own handling, into a Gemini prompt when generation runs (either immediately if the checkbox below is ticked, or later from the detail screen).

Required, non-negotiable, at the point this value is saved and later used:

1. This field's raw value is stored as-is in applications.job_description - no sanitization needed at storage time, since storage is not the risk.
2. The risk is entirely at generation time, in the AI service layer, never here in the frontend. See AI-RULES.md section 2.1 for the full delimiter-based defence.
3. This screen's only responsibility toward that defence: enforce the 15,000 character cap, and do nothing else clever to the text. Do not attempt to strip or sanitize suspicious-looking content here - that responsibility belongs entirely to the prompt-construction layer, where it can be done correctly with full context of how the value will be used.

Input data sent to: applications.job_description. Optional, capped at 15,000 characters.

---

## GenerateCheckbox

Pen shows this checked by default. The designer's note states unchecked by default. Follow the note - the mockup is demonstrating the checked appearance, not the default state.

```jsx
<Checkbox checked={gen} onChange={setGen} disabled={remaining === 0} />
<span className="font-body text-[13px] text-[--color-ink]">
  Generate a cover letter after saving
  {remaining > 0
    ? <span className="text-[--color-muted]"> ({remaining} of {limit} left)</span>
    : <span className="text-[--color-muted]"> - 0 left this month. <a href="/app/settings/plan">Upgrade</a></span>}
</span>
```

onChange: toggles local state only, no API call fires from this checkbox directly - it only affects what happens after Save is clicked.

Disabled state (quota exhausted): bg-[--color-surface-2] on the checkbox, text-[--color-muted] on the label - the corrected color-based disabled treatment, not opacity.

Warning: must show the remaining count before the click, and disable at zero with a visible path to upgrade. Never let the user check this, save, and only then discover generation failed for a reason that was knowable in advance.

Input data sent to: nowhere directly - this is a client-side flag that determines whether F3-3.1 is called after the POST to /api/applications succeeds.

---

## DrawerActions - Cancel and Save

Tailwind (Cancel, secondary): bg-[--color-surface] border border-[--color-border-strong] - identical treatment to every other secondary button in the system (M01 SSO, M02 Back).

Tailwind (Save, primary): identical to every other primary button, fullWidth false here since both buttons share the row.

onClick (Cancel): triggers the close-with-confirmation logic.

onClick (Save):
1. Client-side validation: Company and Role non-empty. Nothing else is required.
2. POST /api/applications with the full form body.
3. On success: if Generate was checked, fire F3-3.1 immediately after (fire-and-forget from the client's perspective - the response doesn't block the drawer closing).
4. Drawer closes, card appears on the board.

Loading state: both buttons disable, Save shows a spinner, aria-busy="true" - prevents a double-click from creating two applications.

onError (server rejects): form-level banner: "Something went wrong saving your application - please try again." Company/Role validation errors are caught client-side before this call fires, so a server error here should be rare, most likely a network failure or a genuine server issue rather than bad input.

---
---

# WHAT'S STILL NOT DRAWN

| | Resolution |
|---|---|
| Backdrop element | Resolved above - we add one, pen source only dims the board |
| Field errors on Company/Role | Resolved above - INTERACTION-STATES.md section 4 pattern applied |
| Saving/loading state | Resolved above - spinner + disabled buttons |
| Duplicate detection (same company+role already tracked) | Still open - not addressed in this pass. Recommend: warn, don't block, since a user may legitimately re-apply after a gap |
| Date applied default | Resolved above - recommend empty, not pre-filled to today |

---

# CONFIRM BEFORE M05

Same check as the prior three screens - is this the right depth? M05 (Application detail) is next, with the timeline event system and the "one code path, two entry points" status-change rule shared with the board's drag.

# SCREEN-SPEC-M05.md — Application detail

Full operational specification. Same depth and format as M01-M04.

Sources merged: SCREEN-NOTES-M05.md (pen values) · TASKS-FRONTEND_quarterfinal.md M05 section · INTERACTION-STATES.md (corrected) · DATABASE_quarterfinal.md sections 3.1-3.2 · DECISIONS_quarterfinal.md L104, L110, L113, L123 · SECURITY_quarterfinal.md section 14 (soft delete)

Designer's intent, verbatim: "One record, four surfaces." · "The timeline is the answer to 'what happened with this one'." · "Status changes from here and from the board drag. Both write the same timeline event - one code path, two entry points." · "The right column is the action surface... because this is the screen the user is on when they remember."

---

# SCREEN

Mockup: Mockup___05_Application_detail.png · pen source yYHoM
Route: /app/applications/:id
GitHub Issue: (create per ISSUES.md before branching)

---

# RESOLUTION

## Breakpoints

| Breakpoint | Width | Layout behavior |
|---|---|---|
| Mobile | < 1024px | Two-column layout stacks to one column. Warning: right column (actions) moves ABOVE the left column (timeline/JD), not below - this is the action surface and is why the user opened the screen |
| lg | greater than or equal to 1024px | Two columns side by side, right column fixed 236px |
| xl+ | greater than or equal to 1280px | No further change |

## Screen resolution - browser

Design canvas: 1440x1040 - the tallest of the six screens. Sidebar 232px + main content area.

## Tablet resolution

768-1023px: still single-column stacking (the 1024px breakpoint for two columns is above tablet width). Tabs remain horizontally scrollable if needed, never wrap to a second row.

## Mobile resolution

Less than 768px: action buttons and the "from the last call" panel appear first, full width. Below them: tabs, then the tab content (Overview/Documents/Call log/Reminders).

## Screen background

bg-[--color-bg] for the page. Cards, panels, and the sidebar are $m-surface.

```jsx
<div className="flex h-screen bg-[--color-bg]">
  <Sidebar />
  <main className="flex flex-1 flex-col overflow-y-auto">
```

---

# TASKS LIST

| Task ID | Component |
|---|---|
| M05-01 | DetailTopBar (back link, status chip, overflow menu) |
| M05-02 | StatusChip (interactive, color-coded by stage) |
| M05-03 | OverflowMenu (delete - only when Rejected) |
| M05-04 | DetailHeader (title, meta chips) |
| M05-05 | DetailTabs (Overview / Documents / Call log / Reminders) |
| M05-06 | JobDescriptionPanel (snapshot, expandable) |
| M05-07 | Timeline (append-only event log) |
| M05-08 | NotesField (autosave) |
| M05-09 | ActionButtons (Generate x2, Log a call, Set a reminder) |
| M05-10 | LastCallPanel (F5 data, empty until F5 ships) |

Backend dependencies: F2-2.3 get single (with deleted_at filter) · F2-2.4 patch status · F2-1.3 application_events · F3-3.5 documents list · F5 (call log, not yet built) · F4 (reminders, F4-2.3).

---

# DATABASE SCHEMA - every read and write this screen produces

| On screen | Table.column | Notes |
|---|---|---|
| Title (company - role) | applications.company, .role | read only |
| Status chip | applications.status | written on change, via the shared status-change service |
| Applied date chip | applications.date_applied | read only |
| Source chip | applications.source | read only (L110) |
| View posting link | applications.source_url | read only, rendered as an external link |
| JD panel | applications.job_description OR documents.jd_snapshot | snapshot takes precedence when one exists (L090) |
| Timeline | application_events, ordered by created_at | append-only, read here |
| Notes | applications.notes | written on blur (autosave) |
| Documents tab | documents where application_id matches | F3 data |
| Call log tab, Last call panel | call_logs (F5 - not yet built) | empty until F5 |
| Reminders tab | reminders where application_id matches | F4 data |

Warning: every read on this screen must resolve deleted_at IS NULL on the applications row itself - a soft-deleted application should 404, not render (L123).

Full reference: DATABASE_quarterfinal.md section 3.

---

# API CALLS

| Trigger | Endpoint | Method |
|---|---|---|
| Page load | /api/applications/:id | GET |
| Status chip changed | /api/applications/:id | PATCH { status } |
| Notes field blurred | /api/applications/:id | PATCH { notes } |
| Delete (Rejected only) | /api/applications/:id | DELETE (soft) |
| Generate cover letter / resume clicked | /api/applications/:id/generate | POST |
| Documents tab opened | /api/applications/:id/documents | GET |
| Reminders tab opened | /api/reminders?application_id= | GET |
| JD panel expanded | none - already loaded with the page | - |

---

# ON SUCCESS

```
Page load success
   |
   Overview tab renders by default
   |
   Documents/Call log/Reminders tabs show counts but are NOT
   fetched until clicked (lazy tab loading)

Status chip changed
   |
   PATCH succeeds -> chip updates color/label immediately
   |
   A new Timeline event appears: "Status changed to X"
   |
   (never navigates away)

Delete clicked (status is Rejected)
   |
   Confirmation dialog
   |
   Confirm -> DELETE (soft) -> redirect to /app/board
   |
   Application now appears in Trash, not the board

Generate button clicked
   |
   -> /app/applications/:id/generate?type=cover_letter  (M06)
   (navigates away from this screen to the generation screen)

Notes autosaved (on blur)
   |
   PATCH succeeds -> small saved indicator appears briefly
   |
   applications.last_activity_at updates (affects board sort)
```

Warning: Generate buttons are the only control on this screen that navigates away. Everything else (status change, notes, delete) either stays on this screen or returns to the board.

---

# FRONTEND COMPONENT REFERENCE

- 1 top bar - back link, status chip, overflow menu
- 1 header - title, three meta chips
- 1 tab bar - four tabs, only Overview has content built (others are F3/F4/F5 shells)
- 1 JD panel - expandable
- 1 timeline - the event log
- 1 notes field
- 4 action buttons - two primary (generate), two secondary (call/reminder)
- 1 key-value panel - last call data, empty until F5

---
---

# COMPONENT-BY-COMPONENT

## DetailTopBar

Tailwind: flex h-16 items-center justify-between border-b border-[--color-border] bg-[--color-surface] px-7

Warning: pen source shows this at 60px on this screen versus 68px on the board and 56px on Generate document. Normalized to 64px across all app chrome, per the design-request sent to the designer.

---

## BackLink

Content: "Board" - but onClick uses browser history (router.back()), not a hardcoded route. The user may have arrived here from the List view, a search result, or a reminder notification, and should return to wherever they actually came from.

onHover: text-[--color-ink-2] to text-[--color-ink].
onFocus: ring-2 ring-inset ring-[--color-accent].

Below md: the "Board" text label drops, leaving only the arrow-left icon at a 44x44 touch target with aria-label="Back".

---

## StatusChip

Colors derive from the stage token, using the same static lookup object established on the board (never string-interpolated - Tailwind purges those from the build):

```jsx
const STAGE_CHIP = {
  saved:      'bg-[--color-muted]/10 border-[--color-muted] text-[--color-muted]',
  applied:    'bg-[--color-primary-soft] border-[--color-primary] text-[--color-primary]',
  assessment: 'bg-[--color-warning-soft] border-[--color-warning] text-[--color-warning]',
  interview:  'bg-[--color-violet-soft] border-[--color-violet] text-[--color-violet]',
  offer:      'bg-[--color-success-soft] border-[--color-success] text-[--color-success]',
  rejected:   'bg-[--color-danger-soft] border-[--color-danger] text-[--color-danger]',
};
```

onClick: opens a dropdown listing all six stages.

onChange (a new stage selected):
1. PATCH /api/applications/:id { status: newStatus }
2. Chip updates optimistically, colors change immediately
3. A new timeline event is written

Critical implementation note: this must call the exact same backend service function that the board's drag-and-drop uses (SCREEN-SPEC-M03.md, OptimisticMove). The designer's note is explicit: "Status changes from here and from the board drag. Both write the same timeline event - one code path, two entry points." The frontend trigger differs (dropdown selection here, drag there); the service function, the timeline-writing logic, and the last_activity_at update must be identical, called from two different UI entry points.

onFocus: ring-2 ring-inset ring-[--color-primary] (this is a field-like control, using primary not accent).
A11y: aria-haspopup="listbox", aria-expanded, Escape closes and returns focus to the chip.

---

## OverflowMenu

Icon: ellipsis, 19x19, $m-ink-2.

onClick: opens a menu with Edit, Duplicate, and conditionally Delete.

Warning: Delete only appears in this menu when applications.status === 'rejected'. This is not a client-side-only restriction for UX polish - the same rule must be enforced server-side on the DELETE endpoint, since a client-side-only check can be bypassed by calling the API directly.

onClick (Delete): confirmation dialog with the exact warning copy from the Data & privacy pattern established in Settings: explains this moves the application to Trash, and that emptying Trash later is permanent and immediate (L113).

A11y: aria-label="More actions", aria-haspopup="menu", arrow-key navigation between items, Escape closes.

---

## DetailHeader

Title: rendered as two separate spans, not a concatenated string, even though it displays as "Company - Role":

```jsx
<h1 className="font-display text-[22px] font-semibold tracking-[-0.3px] text-[--color-ink]">
  {company} <span aria-hidden>-</span> {role}
</h1>
```

Reasoning: both company and role are independently user-supplied text. Concatenating them into one string for display is fine visually, but keeping them as separate data in the render (rather than pre-joining server-side) avoids any encoding ambiguity if either field ever contains a literal " - " itself.

Meta chips (Applied date, Source, View posting): all read-only display, mono 10.5/600, $m-surface-2 fill.

"View posting" onClick: opens applications.source_url in a new tab.

Security, mandatory: rel="noopener noreferrer" and target="_blank" on this link, always. Additionally, the scheme was already validated at input time on M04 (http/https only) - this is the one place that stored, validated URL becomes a live, clickable link, making it the actual point where a bad URL could cause harm if the M04 validation were ever bypassed. Defense in depth: re-validate the scheme here too, not just at input.

---

## DetailTabs

Four tabs: Overview, Documents (count), Call log (count), Reminders (count). Counts are part of the label string itself - "Documents 2" - not a separate badge element.

```jsx
<button role="tab" aria-selected={activeTab === 'documents'}
        onClick={() => setActiveTab('documents')}
        className={cn('px-4 py-[10px] font-body text-[13px]',
          activeTab === 'documents'
            ? 'border-b-2 border-[--color-primary] font-semibold text-[--color-ink]'
            : 'font-medium text-[--color-muted]')}>
  Documents {docCount > 0 && docCount}
</button>
```

onClick: switches the active tab. Tab state lives in the URL (?tab=documents) so a specific tab is linkable and survives a page refresh.

Warning: three of four tabs render empty-shell content until their owning feature ships. Documents shows "No documents yet. Generate one from the actions panel." until F3 populates it. Call log and Reminders show equivalent empty states until F5 and F4 respectively.

A11y: role="tablist" on the container, arrow-key navigation between tabs, role="tabpanel" with tabIndex={0} on the content area, aria-controls linking each tab to its panel.

Below sm: tabs scroll horizontally with overflow-x-auto and no visible scrollbar, rather than wrapping to a second row.

---

## JobDescriptionPanel

Label: "JOB DESCRIPTION SNAPSHOT" - the word SNAPSHOT is significant, surfacing the copy-on-write behavior (L090) to the user. When a snapshot exists (because the JD was edited after a document was generated), this panel shows the JD as it was at generation time, not the application's current (possibly since-edited) JD text.

```jsx
<div className="border border-[--color-border] bg-[--color-surface] p-[18px]">
  <div className="flex items-center justify-between">
    <span className="font-mono text-[10.5px] font-semibold uppercase tracking-[0.8px] text-[--color-ink-2]">
      Job description snapshot
    </span>
    <button onClick={() => setExpanded(e => !e)} aria-expanded={expanded}
            className="flex items-center gap-1 font-body text-[12px] font-semibold text-[--color-accent]">
      {expanded ? 'Collapse' : 'Expand'} <ChevronDown className={expanded ? 'rotate-180' : ''} size={13} />
    </button>
  </div>
  <p className={cn('font-body text-[13px] leading-[1.6] text-[--color-ink-2]',
                   !expanded && 'line-clamp-3')}>
    {jdText}
  </p>
</div>
```

onClick (Expand/Collapse): this is an accordion toggle, not a modal - the text expands in place. aria-expanded and aria-controls on the button, matched to the content region's id.

Security, mandatory: rendered as plain text, never dangerouslySetInnerHTML. This field is user-pasted content and is the same prompt-injection-relevant text discussed on M04 - it must never be interpreted as HTML at render time regardless of what it contains.

Line height here is 1.6, distinct from the 1.5 used on shorter form fields elsewhere - intentional, for a long-form reading surface.

---

## Timeline

Structural element: rendered as an ordered list (ol), since it is semantically a sequence of events in time.

```jsx
<ol className="border border-[--color-border] bg-[--color-surface]">
  {events.map((e, i) => (
    <li key={e.id} className={cn('flex items-center gap-3 px-4 py-[13px]',
                                 i > 0 && 'border-t border-[--color-border]')}>
      <span className="flex size-[26px] items-center justify-center bg-[--color-surface-2]">
        <EventIcon type={e.type} status={e.status} />
      </span>
      <span className="flex-1 font-body text-[13px] text-[--color-ink]">{e.description}</span>
      <span className="font-mono text-[11.5px] text-[--color-muted]">{formatDate(e.created_at)}</span>
    </li>
  ))}
</ol>
```

Icon color logic: a status_changed event takes the color of the stage it moved TO (e.g. moving to Interview shows the violet icon). All other event types (call_logged, follow_up_sent, document_generated) use $m-primary regardless of context.

```jsx
const EVENT_ICON = {
  status_changed:     { icon: CircleDot, color: (status) => STAGE[status].token },
  call_logged:        { icon: Phone,     color: () => 'primary' },
  follow_up_sent:      { icon: Mail,      color: () => 'primary' },
  document_generated: { icon: FileText,  color: () => 'primary' },
};
```

Critical, backend-facing note for this frontend component: this list only ever grows by appending. No timeline event is ever edited or deleted by any user action anywhere in the product. If a bug ever produces an incorrect entry, the correct fix is a new corrective event, never an edit to history.

Debounce awareness: a card dragged rapidly between three columns on the board (SCREEN-SPEC-M03.md) should still only produce ONE status_changed event here, for the final settled position - the 2-second debounce on the write side is what this timeline is implicitly relying on to stay readable.

Empty state: a brand new application shows exactly one event - "Application added" - never a blank timeline.

---

## NotesField

```jsx
<textarea value={notes} onChange={e => setNotes(e.target.value)} onBlur={saveNotes}
          className="h-[70px] w-full border border-[--color-border] bg-[--color-surface]
                     px-[14px] py-3 font-body text-[13px] leading-[1.5] text-[--color-ink]
                     focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[--color-primary]" />
```

onBlur: autosave fires here, debounced slightly (roughly 500ms after blur, to avoid firing if the user is just tab-cycling through the page quickly). No explicit Save button exists for this field, by design - none is drawn in the source, so none should be added.

onSuccess (save): a brief, small "Saved" indicator appears near the field and fades after a couple of seconds. Uses aria-live="polite" so the confirmation is announced to screen reader users, since there is no persistent visual confirmation to rely on otherwise.

Side effect: saving notes updates applications.last_activity_at, which the board's default sort depends on (SCREEN-SPEC-M03.md, Oldest Activity sort option).

Security: rendered as plain text wherever notes are displayed elsewhere in the product, never as HTML.

---

## ActionButtons

Four buttons, two primary (Generate cover letter, Generate resume), two secondary (Log a call, Set a reminder). All carry icons, using the icon slot that M/Button supports but that most buttons elsewhere in the system leave disabled.

```jsx
<Button variant="primary" size="md" icon={FilePlus} fullWidth
        disabled={remaining === 0 || !profileComplete || !emailVerified}
        onClick={() => router.push(`/app/applications/${id}/generate?type=cover_letter`)}>
  Generate cover letter
</Button>
```

Three blocking conditions exist for the two Generate buttons, none of which are drawn in the source mockup:

| Condition | Disabled message shown adjacent to the button |
|---|---|
| Quota exhausted | "0 generations left this month" + link to upgrade |
| Profile incomplete (L098) | "Complete your profile to generate" + link to /app/profile |
| Email unverified (L040) | "Verify your email to start generating" |

Warning: never let a user click a Generate button and have nothing happen. Every blocking condition above must be visibly explained before the click, not discovered after it.

Log a call onClick: navigates toward the F5 flow (not yet built - this becomes a real link once F5 exists).
Set a reminder onClick: navigates toward the F4 flow, specifically creating a reminder tied to this application_id.

onHover (secondary buttons): bg-[--color-surface] to bg-[--color-surface-2].
onFocus (all four): ring-2 ring-inset ring-[--color-accent] (buttons use accent).

---

## LastCallPanel

```jsx
<dl className="border border-[--color-border] bg-[--color-surface]">
  {rows.map((r, i) => (
    <div key={r.key} className={cn('flex flex-col gap-[5px] px-[14px] py-3',
                                    i > 0 && 'border-t border-[--color-border]')}>
      <dt className="font-body text-[12px] text-[--color-muted]">{r.label}</dt>
      <dd className="font-body text-[13px] font-semibold text-[--color-ink]">{r.value}</dd>
    </div>
  ))}
</dl>
```

Structurally a definition list (dl/dt/dd) - semantically correct for key-value data.

Empty state (F5 not yet built, or no calls logged for this application): "No calls logged yet." replaces the row list entirely.

Warning, when F5 ships: values here come from AI extraction of call notes. They must be presented as editable, not as immutable fact, the same principle already established for résumé parsing (L049) - a wrong salary displayed with full confidence is worse for the user than no salary shown at all.

---
---

# WHAT'S STILL NOT DRAWN

| | Resolution |
|---|---|
| Tab empty states (Documents/Call log/Reminders at zero) | Resolved above - specific copy per tab |
| Timeline empty state | Resolved above - "Application added" as the sole first event |
| Generate button disabled states (3 causes) | Resolved above - full table |
| Delete confirmation copy | Resolved above - reuses the Settings deletion warning pattern |
| Notes saving indicator | Resolved above - brief fade-out "Saved" text, aria-live |

---

# CONFIRM BEFORE M06

Same check as the prior four screens - is this the right depth? M06 (Generate document) is next and last - it carries the quota enforcement language directly from the designer's own note, and the five screen-states analysis (only two of which are currently drawn).

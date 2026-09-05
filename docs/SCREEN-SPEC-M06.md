# SCREEN-SPEC-M06.md — Generate document

Full operational specification. Same depth and format as M01-M05. Last of the six main screens.

Sources merged: SCREEN-NOTES-M06.md (pen values) · TASKS-FRONTEND_quarterfinal.md M06 section · AI-RULES.md sections 4, 7, 8, 9 · INTERACTION-STATES.md (corrected) · DATABASE_quarterfinal.md section 4 (forward declarations) · DECISIONS_quarterfinal.md L055, L062, L092, L100, L109, L116

Designer's intent, verbatim: "Quota is always visible. Users should never discover the 5-per-month limit at the moment they hit it." · "The counter is decoration; the server is the enforcement. Quota must be checked in a transaction at generation time, not read from a cached number. A bug in this check isn't a UI bug, it's a billing event."

---

# SCREEN

Mockup: Mockup___06_Generate_document.png · pen source YW201
Route: /app/applications/:id/generate?type=cover_letter (or resume)
GitHub Issue: (create per ISSUES.md before branching)

Warning: this is the only app screen with no sidebar - a deliberately focused, single-task view.

---

# RESOLUTION

## Breakpoints

| Breakpoint | Width | Layout behavior |
|---|---|---|
| Mobile | < 1024px | Left column (controls) stacks ABOVE the right column (result) - controls come first since nothing exists to show in the result area yet |
| lg | greater than or equal to 1024px | Two columns side by side, left fixed 246px |
| xl+ | greater than or equal to 1280px | No further change |

## Screen resolution - browser

Design canvas: 1440x900. No sidebar - full width available to the two-column layout.

## Tablet resolution

768-1023px: still single-column stacking (same 1024px breakpoint as M05). Document type toggle and inputs panel remain full width.

## Mobile resolution

Less than 768px: same stacking, tighter padding. Result card padding drops from [26,28] to [16,16].

## Screen background

bg-[--color-bg] for the page background, cards and panels at $m-surface.

```jsx
<div className="min-h-screen bg-[--color-bg]">
  <header className="flex h-16 items-center justify-between border-b border-[--color-border] bg-[--color-surface] px-8">
  <main className="mx-auto max-w-[1100px] px-8 py-7">
    <div className="grid grid-cols-1 gap-8 lg:grid-cols-[246px_1fr]">
```

---

# TASKS LIST

| Task ID | Component |
|---|---|
| M06-01 | GenerateTopBar (back link naming the application, no sidebar) |
| M06-02 | QuotaBadge (always visible) |
| M06-03 | DocumentTypeToggle (cover letter / resume) |
| M06-04 | InputsPanel (preflight checklist) |
| M06-05 | GenerateButton |
| M06-06 | ResultActions (Regenerate, Edit) |
| M06-07 | ResultCard |
| M06-08 | DownloadRow (Download, Save to application) |
| M06-09 | PaywallPanel (quota exhausted state) |

Backend dependencies: F3-3.1 generate endpoint · F3-3.2 status polling · F3-3.3 regenerate · F3-3.4 manual edit · F3-2.5 quota decrement · F3-2.6 retry policy.

---

# DATABASE SCHEMA - every read and write this screen produces

| On screen | Table.column | Notes |
|---|---|---|
| Quota badge count | generation_quota.used vs subscriptions.tier's limit | read only, computed server-side |
| Document type selection | passed as a param to generation_jobs.type | not stored until Generate is clicked |
| Inputs panel - profile status | profiles.completed_at IS NOT NULL | read only |
| Inputs panel - JD status | applications.job_description IS NOT NULL | read only |
| Generated result | documents.content | written when generation succeeds - persisted immediately, not on the later "Save" click (L116) |
| provider/model stamp | documents.provider, documents.model | written alongside content, for traceability |
| Download (Pro only) | documents.r2_key | written only if a Pro user explicitly saves a PDF (L062) |

Full reference: DATABASE_quarterfinal.md section 4.

---

# API CALLS

| Trigger | Endpoint | Method |
|---|---|---|
| Generate button clicked | /api/applications/:id/generate | POST { type } |
| While job is running | /api/generate/:jobId/status | GET, polled |
| Regenerate clicked | /api/documents/:id/regenerate | POST |
| Edit clicked, then saved | /api/documents/:id | PATCH { content } |
| Download clicked (Pro) | /api/documents/:id/download | GET, returns a PDF |
| Save to application clicked | none additional - document already persisted at generation (L116) | - |

---

# ON SUCCESS

```
Generate clicked
   |
   POST /generate -> job enqueued, returns immediately (never blocks)
   |
   Screen shows "Generating..." state, polling /status
   |
   Poll returns succeeded
   |
   Result renders. Document is ALREADY persisted at this point (L116) -
   navigating away now does not lose the generation the user paid a
   quota unit for
   |
   "Save to application" click is now just an attach-and-return action,
   not the actual persistence step
   |
   -> /app/applications/:id  (M05, back to the detail screen)

Generate clicked, but a blocking condition exists
   (quota exhausted / profile incomplete / email unverified)
   |
   Button is already disabled before the click - this path should not
   be reachable, but if somehow triggered, the API rejects with the
   same reason shown in the disabled state

Regenerate clicked
   |
   Same flow as Generate, but explicitly decrements quota again (L109)
   |
   Previous result is replaced, not appended alongside

Job fails after 2 attempts (permanent failure)
   |
   Error state renders with a manual Retry button
   |
   Quota is refunded (the failure was not the user's fault, per
   AI-RULES.md section 7)
```

---

# FRONTEND COMPONENT REFERENCE

- 1 top bar - back link (names the application, not "Board"), no sidebar
- 1 quota badge - always visible, changes copy for Pro users
- 1 left column - document type toggle, inputs checklist, generate button
- 1 right column - result card, actions, download row, or the paywall panel

---
---

# COMPONENT-BY-COMPONENT

## GenerateTopBar

Tailwind: flex h-16 items-center gap-[10px] border-b border-[--color-border] bg-[--color-surface] px-8

Warning: pen source shows 56px here, versus 68/60/64 on other screens. Normalized to 64px, matching the design-request sent to the designer.

BackLink content: the application's title (e.g. "Razorpay - Product Designer II"), not a generic "Board" label - this is deliberate, since the destination is M05 specifically, not the board.

onClick: router.back(), same reasoning as M05's back link - returns wherever the user actually came from.

Below sm: title truncates with text-ellipsis rather than wrapping the top bar to two lines.

---

## QuotaBadge

```jsx
<div className="flex items-center gap-2 bg-[--color-accent-soft] px-3 py-[7px]"
     role="status" aria-live="polite">
  <span className="font-body text-[12.5px] font-semibold text-[--color-accent]">
    {isPro ? 'Unlimited generations' : `${remaining} of ${limit} generations left this month`}
  </span>
  <Info size={15} className="text-[--color-muted]" />
</div>
```

Warning, critical: Pro users see "Unlimited generations" (or the L093 fair-use figure if you choose to surface it), never the free-tier "3 of 5" string. Showing a Pro subscriber a numeric cap they are not actually bound by is a support ticket waiting to happen.

aria-live="polite" so the count updates are announced after a successful generation completes.

### This badge is decoration - repeating the designer's own words because they are exactly right

"The counter is decoration; the server is the enforcement. Quota must be checked in a transaction at generation time, not read from a cached number. A bug in this check isn't a UI bug, it's a billing event."

The actual enforcement is the single atomic SQL statement specified in DATABASE_quarterfinal.md section 5 and implemented in F3-2.5. This badge exists purely so a user is never surprised by hitting a limit they had no visibility into beforehand - it has zero authority over whether generation is actually allowed.

Below sm: text shortens to "3 of 5 left" - the full string competes with the back link for space on a narrow screen.

---

## DocumentTypeToggle

Same filled selected-state pattern as M02's LocationSegmented, oriented vertically here instead of horizontally:

```jsx
<div role="radiogroup" aria-label="Document type" className="flex flex-col gap-[9px]">
  {(['cover_letter', 'resume'] as const).map(t => (
    <button key={t} role="radio" aria-checked={type === t} onClick={() => setType(t)}
            className={cn('px-4 py-3 text-center font-body text-[13.5px] font-semibold border',
              type === t
                ? 'bg-[--color-primary] border-[--color-primary] text-white'
                : 'bg-[--color-surface] border-[--color-border-strong] text-[--color-ink-2]')}>
      {LABEL[t]}
    </button>
  ))}
</div>
```

onClick: switches the selected type, resets the InputsPanel and any prior result if one was showing (switching type mid-review discards the unsaved context, since the two document types are independent generations).

onFocus: ring-2 ring-inset ring-[--color-primary] (this is a field-like value picker, using primary).

Below lg: renders as a horizontal row instead of vertical stack, since the left column becomes full-width above the result on mobile.

---

## InputsPanel - a preflight checklist, not a form

```jsx
<dl className="border border-[--color-border] bg-[--color-surface]">
  <Row label="Your profile" status={profileComplete ? 'success' : 'danger'}
       text={profileComplete ? 'Complete' : 'Incomplete - complete your profile'} />
  <Row label="Job description" status={hasJd ? 'success' : 'warning'}
       text={hasJd ? 'Snapshot saved' : 'No job description'} />
  <Row label="Email verified" status={emailVerified ? 'success' : 'danger'}
       text={emailVerified ? 'Verified' : 'Verify your email'} />
</dl>
```

Only the success state is drawn in the pen source. The failure states above are our own addition, resolving what was previously an open item - this panel's entire purpose is to tell the user, before they spend a generation, whether it can succeed. A panel that only ever shows green is not doing that job.

Warning: email verification (L040) gates first generation but was not a row in the original mockup. Added here as a third row rather than only blocking at the button, since the panel's stated purpose is showing readiness before the click.

Tone selector: the pen source includes a "Tone: Standard" row. L100 removed this from MVP - the PRD's AI generation section lists cover letter, resume, download, the counter, and storage, with no tone control. This row is omitted entirely rather than rendered disabled, since a disabled row with no path forward is confusing UI weight for a feature that does not exist yet.

A11y: this is a definition list (dl/dt/dd) semantically. Status badges must carry text, never rely on color alone - "Complete" and "Incomplete" as visible words, not just green/red dots.

---

## GenerateButton

```jsx
<Button variant="primary" fullWidth
        disabled={!allChecksPass || remaining === 0 || generating}
        loading={generating}
        onClick={handleGenerate}>
  {generating ? 'Generating...' : 'Generate'}
</Button>
<p className="font-body text-[11.5px] leading-[1.5] text-[--color-muted]">
  Takes about 5 seconds. Uses one generation.
</p>
```

Warning: the helper text states the cost before the click - this exact pattern (state the cost, then let the user decide) is required again on the Regenerate button below, per L109.

onClick (handleGenerate):
1. POST /api/applications/:id/generate { type }
2. Response returns immediately with a jobId - this call never blocks waiting for Gemini
3. Begin polling GET /api/generate/:jobId/status
4. On 'succeeded': render the result (document is already persisted server-side at this point)
5. On 'failed' after retries exhausted: render the error state with Retry

Warning, critical: never block the request thread on the actual Gemini call. Holding a database connection open for the ~5 second generation time, multiplied across concurrent users, is a real denial-of-service vector against your own connection pool - this is why the queue and polling pattern exists at all, not merely a UX nicety.

Retry behavior (AI-RULES.md section 8.1): transient failures (timeout, 429, server error) retry automatically up to twice, invisibly - the user just keeps seeing "Generating...". Permanent failures (bad request, safety block, validation failure) stop immediately and show the manual Retry button. This distinction is identical for free and Pro users - a transient failure is never the user's fault and costs them nothing to retry.

---

## ResultActions - Regenerate and Edit

A fourth button treatment distinct from primary/secondary/accent, established specifically by this screen:

```jsx
<button onClick={confirmRegenerate} disabled={remaining === 0}
        className="flex items-center gap-[5px] bg-[--color-surface-2] px-[10px] py-[6px]
                   font-body text-[12px] font-semibold text-[--color-ink-2]
                   focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[--color-accent]">
  <RotateCw size={12} />
  Regenerate {remaining > 0 && `(${remaining} left)`}
</button>
```

Warning, critical: Regenerate is a full-price generation call and decrements quota exactly like the initial Generate click (L109). It must show its cost in the label itself, and disable at zero quota, using the identical pattern as the primary Generate button.

Consider a confirmation step before firing: a user unhappy with the first result could otherwise click Regenerate three times in ten seconds and consume their entire month's allowance in a moment of impatience. A simple "Regenerate? This uses 1 generation" inline confirm is enough - not a full modal.

Edit button onClick: converts the result card into an editable textarea in place, same visual box, same typography, so there is no jarring layout shift between reading and editing modes. Saving this calls PATCH /api/documents/:id { content } - explicitly no AI call, no quota consumption, since this is the user's own edit of already-generated text.

Warning, touch target: pen source shows this button at padding [6,10] with 12px text, producing roughly a 28px tall control - below the 44x44 minimum touch target. Increase padding on mobile (md and below) to meet the minimum, even though the compact size is correct for desktop.

---

## ResultCard

```jsx
<article aria-live="polite"
         className="whitespace-pre-line border border-[--color-border] bg-[--color-surface]
                    px-7 py-[26px] font-body text-[13px] leading-[1.6] text-[--color-ink-2]">
  {content}
</article>
```

Warning, deliberate simplification from the mockup: the pen source styles the opening salutation and the closing sign-off at weight 600, distinct from the normal-weight body paragraphs. This requires reliably identifying a salutation and sign-off within AI-generated text, which is not a safe assumption - "Dear Hiring Team," is easy to detect, but "To the Razorpay design team -" or a model output with no traditional salutation at all is not. A misparse renders worse than uniform text. Rendering the entire result at one consistent weight with whitespace-pre-line (which preserves the model's own paragraph breaks without any parsing) is the safer choice, flagged to the designer as a deliberate divergence.

Security, mandatory, no exceptions: this content is rendered as plain text via React's default escaping, never via dangerouslySetInnerHTML. This text originates from a job description the user pasted, which is the same prompt-injection-relevant content discussed on M04 - treating model output as literal HTML at render time would be a second, independent vulnerability on top of the prompt-injection surface already addressed at the generation layer.

Loading state (while generating=true): a skeleton matching this card's exact padding and approximate line structure, not a spinner - prevents the layout from visibly jumping when real content replaces the placeholder.

---

## DownloadRow

```jsx
<Button variant="secondary" icon={Download}
        onClick={isPro ? handleDownload : openUpgradeModal}>
  Download {!isPro && <Lock size={13} aria-label="Pro feature" />}
</Button>
<Button variant="primary" onClick={handleSaveToApplication}>
  Save to application
</Button>
```

Warning, critical: the pen source draws Download as fully enabled regardless of plan - this is incorrect against L062, which gates PDF download to Pro. Per your confirmed decision (C2): show it, lock it, do not disable it. A free user sees the button, clicks it, and is taken to the upgrade flow rather than encountering a greyed-out control that explains nothing. Free users can still select and copy the visible text on screen - only the convenience of a formatted PDF download is gated.

"Save to application" - per L116, the document is already persisted in the database at generation time, not deferred until this click. This button is an attach-and-return action: it confirms the association is set and navigates back to M05. A user who generates a result and closes the tab without ever clicking this button has not lost their generation - it exists, linked to the application, regardless.

onSuccess (Save to application clicked): writes an application_events entry ("Cover letter generated" or equivalent), which is what makes the "Doc" tag appear on the corresponding board card (SCREEN-SPEC-M03.md, CardTag).

---

## PaywallPanel - quota exhausted state

```jsx
<div role="status" className="flex items-center justify-between gap-5 border border-[--color-accent]
                                bg-[--color-accent-soft] px-5 py-[18px]">
  <div className="flex flex-col gap-[6px]">
    <div className="flex items-center gap-[6px]">
      <Lock size={14} className="text-[--color-accent]" />
      <span className="font-body text-[13.5px] font-bold text-[--color-accent]">
        All 5 generations used - they reset on {resetDate}
      </span>
    </div>
    <p className="font-body text-[12.5px] leading-[1.5] text-[--color-ink-2]">
      Tracking stays unlimited - this only affects new document generation.
    </p>
  </div>
  <Button variant="accent" onClick={openUpgradeModal}>Upgrade</Button>
</div>
```

Warning, copy correction from the original mockup: pen source reads "You've used all 5 free generations this month" - second-person phrasing that reads as blame. Revised per AI-RULES.md section 8.3's tone rules: describe the state, name the path forward, never assign fault. "All 5 generations used - they reset on [date]" states the same fact without the accusatory framing.

The second line ("Tracking stays unlimited...") is copy already in the pen source and is genuinely good - it prevents the user from assuming the entire product has stopped working, correctly communicating the exact free/paid boundary (L055: tracking is always free, only generation is metered).

Warning, critical: resetDate must be computed server-side as the first day of the next calendar month, IN THE USER'S TIMEZONE (L041), never hardcoded and never computed client-side from the browser's local time, which may not match the timezone the user registered with.

The Upgrade button uses a fifth button treatment - $m-accent fill, distinct from primary/secondary/ghost - established specifically for this single high-intent conversion moment.

---
---

# THE FIVE SCREEN STATES

| State | Status in this document |
|---|---|
| Ready (inputs complete, quota available) | Drawn in the source mockup |
| Generating (~5 seconds) | Resolved above - skeleton matching the result card's shape |
| Result | Drawn in the source mockup |
| Quota exhausted | Drawn in the source mockup (PaywallPanel), copy corrected above |
| Blocked (profile incomplete / email unverified) | Resolved above - InputsPanel failure rows plus disabled Generate button with adjacent explanation |
| Failed (after 2 attempts) | Resolved above - error message plus manual Retry, quota refund confirmed in the copy |

---

# CONFIRM - ALL SIX SCREENS NOW SPECIFIED

M01 through M06 are complete at this operational depth. Remaining screens (F4's follow-up screen, F5's post-call log, F6's payment flow, the marketing site) either have no mockup yet or were covered separately in F4-TASKS.md and SCREEN-NOTES-F6-PAYMENTS.md rather than at this full component-by-component depth, since those either lack a finished design or were treated as backend-task documents rather than frontend screen specs.

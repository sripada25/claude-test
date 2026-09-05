# Pipeline Board — List View: Implementation Notes

Source design: `Admin.pen` → `RNyIj` ("Mockup — 03b Pipeline board (List)")
Companion design: `RFVkJ` ("Mockup — 03 Pipeline board") — the board/kanban view of the same data
Status: **design approved, not yet built.** No frontend/backend code exists for this screen.

These notes describe how to implement the mockup under the rules in
[AGENTS.md](../../AGENTS.md) and [CLAUDE.md](../../CLAUDE.md). Where the design
implies a product decision that is not recorded in `docs/`, it is marked
`ASSUMPTION:` or `OPEN DECISION:` rather than silently encoded.

---

## 1. What this screen is

A second view mode over the **same** `applications` dataset already rendered by
the board view. It is not a new page and not a new resource — it is a different
presentation, plus one capability the board cannot offer: **multi-select and
bulk mutation**.

Everything outside the content area (sidebar, top bar, search, filters, sort,
"Add application" button) is shared with the board view and must not be
duplicated. In the mockup, `RNyIj` was produced by copying `RFVkJ` and replacing
only the body — the implementation should mirror that: one route, one chrome,
two body renderers.

---

## 2. Routing and view-mode state

Board and list are the same route with the view mode in the query string, so a
list view with filters applied is linkable and survives refresh.

```
/applications?view=list&status=applied&source=linkedin&sort=updated_desc&page=1
```

- `view` — `board` | `list`, default `board`. Anything else falls back to `board`.
- Read/write with React Router's `useSearchParams`. Do **not** hold view mode in
  component state or `localStorage` — the URL is the single source of truth.
- Toggling the view must not refetch if the underlying query params are
  unchanged and the data is already in the TanStack Query cache. Board and list
  should share a query key so switching is instant.

`ASSUMPTION:` view preference is not persisted per user. If product wants the
last-used view remembered across sessions, that is a `users` table column and a
separate decision.

---

## 3. Data contract

### Endpoint

```
GET /api/applications
```

One endpoint serves both views. The board groups client-side by `status`; the
list paginates. `ASSUMPTION:` the board's per-column counts (Saved 4, Applied
12, Assessment 3, Interview 2, Offer 0, Rejected 9 in the mockup) come from the
same response's `counts` object, so both views agree without a second request.

### Query parameters

| Param | Type | Notes |
|---|---|---|
| `status` | enum, repeatable | `saved` \| `applied` \| `assessment` \| `interview` \| `offer` \| `rejected` |
| `source` | enum, repeatable | see §4 — taxonomy is an OPEN DECISION |
| `q` | string | free text over company + role; trimmed, max 200 chars |
| `sort` | enum | `updated_desc` (default), `updated_asc`, `company_asc`, `company_desc`, `next_action_asc` |
| `page` | int ≥ 1 | default 1 |
| `pageSize` | int | default 10, max 100 — mockup footer shows "Rows: 10" |

### Response

```ts
{
  items: ApplicationListItem[];
  page: number;
  pageSize: number;
  total: number;            // drives "Showing 10 of 30 applications"
  counts: Record<PipelineStatus, number>;  // drives board column badges
}

interface ApplicationListItem {
  id: string;
  company: string;          // "Freshworks"
  role: string;             // "Design Lead"
  status: PipelineStatus;   // "applied"
  source: string | null;    // "Careers page"
  updatedAt: string;        // ISO; UI renders relative ("1d")
  nextAction: {             // null when no open action
    id: string;
    label: string;          // "Send follow-up email"
    dueAt: string | null;   // ISO; drives the Today/Overdue/Due Fri chip
  } | null;
}
```

The list row needs no fields the board card doesn't already need, so a single
DTO serves both. Do not add a `?view=` param that changes the response shape —
the server should not know about presentation.

---

## 4. Pipeline status and source enums

**Status** is a closed enum, ordered, and drives both the board columns and the
list's status tag. Define it once and share it between frontend and backend via
the Zod schema:

```ts
export const PIPELINE_STATUS = ['saved','applied','assessment','interview','offer','rejected'] as const;
```

Persist as a Postgres enum or a `text` column with a `CHECK` constraint —
not as free text. Reordering or renaming a stage is a migration, not a
config change.

**Source** — `OPEN DECISION:` there is no documented source taxonomy. The
mockup shows LinkedIn, Referral, Careers page, and a deliberately generic "Job
board". Naukri and Indeed are marked OPEN DECISION in `CLAUDE.md` for auth, and
naming them here would imply integrations that do not exist. Until product
rules on this, either:

- ship `source` as nullable free text with a suggested-values datalist, or
- ship a small closed enum and accept a migration when it changes.

Do not invent the enum in code and treat it as settled.

---

## 5. Database and query notes

`applications` already exists in the proposed DDL in
[docs/DATABASE.md](../../docs/DATABASE.md). Confirm the following before
building; add them by migration if absent.

- **Ownership scoping is mandatory and manual.** Railway Postgres has no
  row-level security, so every query in this feature carries
  `WHERE user_id = $currentUser`. This applies to the list query, the count
  query, and *every id in a bulk mutation* — see §9.
- **Index for the default sort + filter:**
  `(user_id, updated_at DESC)` covers the unfiltered default page.
  `(user_id, status, updated_at DESC)` covers the common status-filtered case.
- **Total count:** use a windowed `COUNT(*) OVER ()` in the same query rather
  than a second round trip, or accept an approximate count if the table grows.
  At the scale this feature targets (hundreds of rows per user) an exact count
  is fine.
- **`next_action`** is a join, not a column. `ASSUMPTION:` follow-up actions
  live in their own table (the design has an "08 — Follow-up" screen). The list
  needs the single soonest open action per application — use a lateral join
  ordered by `due_at` with `LIMIT 1`, not a fetch-all-then-filter in the
  service layer.
- **Keyset pagination** is the right long-term answer for `updated_desc`, but
  the mockup's numbered pagination (‹ 1 2 3 ›) requires offsets. Offset
  pagination is acceptable here given per-user row counts. Revisit only if a
  user legitimately has tens of thousands of applications.

---

## 6. Backend layering

Follow the documented `routes → controllers → services → repositories` split.
Do not shortcut it because this is "just a list".

```
routes/applications.routes.ts        GET /  , POST /bulk
validators/applications.schema.ts    Zod: query params + bulk body
controllers/applications.controller.ts  parse → call service → shape response
services/applications.service.ts     authorization, business rules, bulk orchestration
repositories/applications.repo.ts    all SQL / Drizzle queries live here only
```

- Zod validates and **coerces** query params at the controller boundary. Reject
  unknown `sort` values with 400 rather than silently defaulting — a typo'd sort
  that quietly returns default order is a debugging trap.
- No SQL outside the repository. No authorization logic outside the service and
  the shared auth middleware.

---

## 7. Frontend component breakdown

**No third-party UI libraries.** No shadcn/ui, Radix, Headless UI, MUI, or any
"headless" package that ships component behavior. Every component below is
hand-built with React + TypeScript + Tailwind + semantic HTML.

```
ApplicationsPage                  route shell; owns search params + query
├── ApplicationsToolbar           search, status/source filters, sort, view toggle, Add
├── ViewToggle                    Board | List segmented control
└── ApplicationsListView
    ├── BulkActionBar             renders only when selection.size > 0
    ├── ApplicationsTable
    │   ├── TableHeaderRow        column labels + select-all checkbox
    │   └── ApplicationRow ×N     checkbox, identity, status tag, source, next action, updated, overflow
    └── TablePagination           count text + page controls
```

Reuse the components the design system already defines — in the mockup these
rows are built from `M/Tag` (`QkzbE`) and `M/Checkbox` (`Q7flhB`) instances, so
the React equivalents must be the same shared `Tag` and `Checkbox` components
used elsewhere, not row-local markup.

### Semantic markup

Use a real `<table>`. This is tabular data with a header row and sortable
columns; a grid of `<div>`s would have to reimplement what the browser and
screen readers already do.

```html
<table>
  <thead><tr><th scope="col">…</th></tr></thead>
  <tbody><tr>…</tr></tbody>
</table>
```

Column widths come from `<colgroup>` so header and body cells cannot drift apart.

---

## 8. Layout spec (measured from `RNyIj`)

Frame 1440×900. Sidebar 232. Main 1208. Top bar 68 tall. Body 832 tall with
28px horizontal / 26px vertical padding → **1152px content width**.

| Element | Value |
|---|---|
| Bulk bar | 1152 × 34, then 12px gap |
| Table card | 1152 × 734, 1px `$m-border`, `$m-surface` fill |
| Header row | 38 tall, `$m-bg` fill, 1px bottom border |
| Data row | 65 tall, 1px bottom border (omitted on last row) |
| Footer | 50 tall, `$m-bg` fill, 1px top border |
| Row padding | 16px left/right |
| Column gap | 14px |

### Columns (sum to 1120 inside 16px padding)

| Column | Width | Content |
|---|---|---|
| Select | 16 | checkbox |
| Application | fill (506 @1440) | 30×30 logo tile + company (13/600) over role (mono 10, muted) |
| Status | 110 | `Tag` |
| Source | 110 | body 12, `$m-ink-2` |
| Next action | 210 | label 12.5 + optional due chip |
| Updated | 64 | mono 11, `$m-muted` |
| Overflow | 20 | ellipsis icon |

Only the Application column flexes. The five right-hand columns are fixed, which
is what keeps them aligned across rows — verified in the mockup at
STATUS@566, SOURCE@690, NEXT ACTION@814, UPDATED@1038 for every row.

`ASSUMPTION:` below ~1100px viewport this table needs a responsive treatment
that the mockup does not specify. Suggested: drop Source, then Next action, into
a second line under the company name. Needs a design decision before build.

---

## 9. Selection and bulk actions

This is the reason the list view exists. The board cannot do it.

### Selection model

- `useState<Set<string>>` of application ids, held by `ApplicationsListView`.
- **Selection is scoped to the current page and cleared on page change, filter
  change, or sort change.** Do not carry a hidden selection across pages — a
  user who selects 3 rows, filters, and hits Delete must not destroy rows they
  can no longer see.
- Select-all in the header selects **the visible page only**. If product wants
  "select all 30 matching", that is a distinct affordance with its own
  confirmation copy — `OPEN DECISION:` not in this design.
- Shift-click range selection is expected behavior for a table like this.
  Not in the mockup; treat as a follow-up.

### Bulk endpoint

```
POST /api/applications/bulk
{ "action": "move_stage" | "add_reminder" | "generate_documents" | "export" | "delete",
  "ids": string[],                    // max 100
  "payload": { … }                    // action-specific, Zod-discriminated on `action`
}
```

Non-negotiables:

- **Re-verify ownership server-side for every id.** Never trust the id list.
  Fetch the rows `WHERE id = ANY($ids) AND user_id = $currentUser` and if the
  returned count ≠ `ids.length`, reject the whole request — do not silently
  operate on the subset. A mismatch means either a bug or an attack.
- **Run in a transaction.** Partial application of a bulk action leaves the user
  unable to tell what happened.
- **`delete` requires confirmation** in the UI and should be a soft delete
  unless `docs/` says otherwise. `OPEN DECISION:` data retention policy is not
  documented.
- **`generate_documents` is not synchronous.** AI generation goes through the
  Gemini pipeline and is slow and quota-metered. This action enqueues jobs and
  returns immediately; the UI shows a toast and the rows reflect status when the
  jobs land. It must also check the user's remaining generation quota *before*
  enqueuing and fail cleanly with the remaining count. Bulk-generating for 10
  applications on a Free plan with 5 generations left must not half-succeed.
- **`export` returns a CSV stream**, not JSON. Scope it to the same filters and
  ownership as the list query.

### Optimistic updates

`move_stage` should update optimistically (TanStack Query `onMutate` + rollback
on error) because it is instant and reversible. `delete` and
`generate_documents` should not — they need server confirmation.

---

## 10. States not covered by the mockup

The design shows only the populated, mid-interaction state. All of these need
building and none are drawn:

- **Empty (no applications at all)** — should route the user to "Add application",
  not show an empty table with headers.
- **Empty (filters match nothing)** — distinct from the above; needs a "clear
  filters" action.
- **Loading** — skeleton rows at the same 65px height to avoid layout shift.
  Do not use a spinner that collapses the table.
- **Error** — failed fetch, with retry.
- **Bulk action in flight** — bulk bar disabled with progress.
- **Partial/failed bulk result** — what the user sees when the server rejects.

Flag these to design before implementation; guessing them produces inconsistent
copy and behavior.

---

## 11. Accessibility

- Native `<table>` semantics; `scope="col"` on headers.
- Sortable headers are `<button>`s inside `<th>` with `aria-sort` reflecting
  current state.
- Each row checkbox needs an accessible label naming the row
  (`aria-label="Select Freshworks — Design Lead"`), not a bare "Select".
- The bulk bar appearing on first selection must be announced —
  `role="status"` / `aria-live="polite"` on the "2 selected" count.
- Full keyboard path: tab to checkbox, space to toggle, tab to bulk actions.
  The row overflow menu must open on Enter/Space and trap focus while open.
- Status is conveyed by tag **text**, not color alone — already correct in the
  design. Keep it that way; do not reduce tags to colored dots.
- Verify `$m-muted` (#8B8778) on `$m-surface` for the mono role text at 10px —
  small text at that contrast is the most likely WCAG AA failure on this screen.

---

## 12. Security checklist

Per [docs/SECURITY.md](../../docs/SECURITY.md), before this ships:

- [ ] Every query in the list and bulk paths is ownership-scoped in application code.
- [ ] Bulk ids re-verified server-side; count mismatch rejects the whole request.
- [ ] `pageSize` capped server-side (max 100) — an uncapped page size is a trivial DoS.
- [ ] `q` parameterized, never interpolated into SQL.
- [ ] Bulk and export are POST/authenticated, CSRF-protected, session-cookie based.
- [ ] Export cannot be coerced into dumping another user's rows.
- [ ] Rate-limit `generate_documents` — it costs money per call.
- [ ] No application data in logs; `pino` redaction covers company/role/notes.

---

## 13. Test plan

**Unit (Vitest)** — status/source enum parsing; relative-time formatting
("1d", "Today", "Overdue"); selection reducer including the clear-on-filter-change rule.

**Integration (Vitest + test DB)** — list filtering, sorting, pagination, and
counts; ownership isolation (user A cannot list or bulk-mutate user B's rows);
bulk partial-id rejection; quota rejection on `generate_documents`.

**E2E (Playwright)** — toggle board↔list preserves filters in the URL; select
two rows → bulk bar appears → move stage → rows reflect new status; filter change
clears selection; pagination updates the "Showing X of Y" count.

---

## 14. Open decisions blocking a complete build

1. **Source taxonomy** — free text or closed enum, and which values. (§4)
2. **Delete semantics** — soft vs hard, and retention. (§9)
3. **"Select all matching"** beyond the current page — wanted or not. (§9)
4. **Responsive behavior** below ~1100px. (§8)
5. **Empty / loading / error / partial-failure states** — undesigned. (§10)
6. **View preference persistence** across sessions. (§2)

Items 1–3 change the data model or the API contract, so they should be resolved
before the endpoint is written. Items 4–6 can be resolved during frontend build.

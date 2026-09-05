# SCREEN-NOTES-M01.md — Sign in / Create account

Pen source: `Z8gwhK` → `D66lO` (Sign in card) · read 2026-08-26
Screen: `Mockup___01_Sign_in___Create_account.png`

**Every property below is read from the `.pen` file, not estimated.** Tokens resolve via `DESIGN-SYSTEM.md` §2.1.

---

# 0 · TWO NOTES ON METHOD

**Layout values are not copied literally.** The canvas is 1440px fixed; you've confirmed responsive. Fixed frame widths become flex relationships. **Component internals — padding, gap, type — are exact**, because inconsistency there compounds across every screen.

**"Can this component handle 100 concurrent users?" doesn't apply to components.** A React button renders identically for 1 user or 100 — it runs in each person's browser. Concurrency lives in the **endpoint it calls**. So performance notes below attach to API calls, not to rendering. Where a component has no API, there is no concurrency question.

---

# 1 · SCREEN CONTAINER

```
Sign in card  D66lO
  width 420 · fill $m-surface · stroke $m-border 1px
  layout vertical · padding [44, 40]
  NO cornerRadius → square corners
```

```jsx
<main className="w-full max-w-[420px] bg-[--color-surface] border border-[--color-border] px-10 py-11">
```

Centred on `$m-bg`. Responsive: full width below `sm`, capped at 420px above.

**Vertical rhythm** — the file uses explicit spacer frames rather than margins:

| Spacer | Height | Between |
|---|---|---|
| Gap1 | 28 | brand → heading |
| Gap2 | 6 | heading → subtitle |
| Gap3 | 26 | subtitle → form |
| Gap4 | 22 | form → divider |
| Gap5 | 22 | divider → SSO |
| Gap6 | 26 | SSO → rule |
| Gap7 | 18 | rule → "New here" |
| Gap8 | 22 | "New here" → terms |

In React these become `space-y-*` or explicit margins — **do not render empty divs**.

---

# 2 · COMPONENTS ON THIS SCREEN

## 2.1 · `BrandMark` — `IKofg`

| | |
|---|---|
| **Pen** | frame `IKofg`, gap 9, align center |
| **Mark** | `SxBFa` 26×26, fill `$m-accent`, centred |
| **Letter** | `y0pjU` "T" · display · 13px · 700 · `#FFFFFF` |
| **Wordmark** | `sEcV4` "TRACKR" · display · 16px · 700 · `letterSpacing 0.2` · `$m-ink` |

```jsx
<div className="flex items-center gap-[9px]">
  <span className="grid size-[26px] place-items-center bg-[--color-accent]
                   font-display text-[13px] font-bold text-white">T</span>
  <span className="font-display text-[16px] font-bold tracking-[0.2px]
                   text-[--color-ink]">TRACKR</span>
</div>
```

**React** — pure presentational, no props, no state. Links to `/` on marketing pages, not clickable here.
**A11y** — the whole mark is decorative alongside the heading; give the container `aria-hidden` if the heading already says "Sign in to Trackr". Otherwise `aria-label="Trackr"`.
**Refs** — no task; part of T8.1. No API, no DB.

## 2.2 · `AuthHeading` — `YUKjD` + `dXTUL`

| | |
|---|---|
| **Heading** | display · 23px · 600 · `letterSpacing -0.3` · `$m-ink` |
| **Sub** | body · 14px · normal · `lineHeight 1.5` · width 340 · `$m-ink-2` |
| **Content** | "Sign in to your account" / "Track applications, generate documents, never miss a follow-up." |

**React** — `mode: 'signin' | 'signup'` swaps both strings. **Same component, same route** — your decision that Create account is this screen with a different heading.
**A11y** — `<h1>`, exactly one per page.
**Refs** — T8.1 · discussion: *"when user clicks on the create account link it will also have same screen (signin) but one change in heading"*

## 2.3 · `EmailField` — `ugSX3` → **instance of `M/Field`** (`scDqq`)

```
ref: scDqq · width fill_container
overrides: n2hl8s.content = "EMAIL" · Fy7XM.content = "you@example.com"
```

**This is a true component instance.** Inherits from `M/Field`:

| | |
|---|---|
| **Layout** | vertical, gap 7 |
| **Label** | mono · 10.5px · 600 · `letterSpacing 0.8` · `$m-ink-2` · UPPERCASE |
| **Box** | fill `$m-surface` · stroke `$m-border` 1px · padding [11, 13] |
| **Value** | body · 13.5px · normal · `$m-ink` (placeholder `$m-muted`) |

```jsx
<div className="flex w-full flex-col gap-[7px]">
  <label htmlFor="email" className="font-mono text-[10.5px] font-semibold
                                    uppercase tracking-[0.8px] text-[--color-ink-2]">
    Email
  </label>
  <input id="email" type="email" autoComplete="email" required
         placeholder="you@example.com"
         className="w-full border border-[--color-border] bg-[--color-surface]
                    px-[13px] py-[11px] font-body text-[13.5px] text-[--color-ink]
                    placeholder:text-[--color-muted]
                    focus:outline-2 focus:outline-offset-0 focus:outline-[--color-primary]
                    aria-[invalid=true]:border-[--color-danger]" />
</div>
```

**React** — controlled. `onChange` updates state; **`onBlur` validates**, not per keystroke. `error` prop sets `aria-invalid` and renders below.
**onHover** — none in the design. Border stays `$m-border`.
**onFocus** — not defined in the file. Proposed: 2px `$m-primary` outline. **Needs designer confirmation.**
**Validation** — client: non-empty, contains `@`. Server is authoritative.
**API** — feeds `POST /api/auth/login` and `/signup`.
**DB** — `users.email CITEXT UNIQUE` (`DATABASE.md` §2.1). `citext` blocks case-variant duplicates.
**Security** — `type="email"` only shapes the mobile keyboard; **never treat it as validation**. Value goes in the JSON body, never a query string.
**A11y** — real `<label for>`. Placeholder is not a label.
**Refs** — T8.1 · T1.2 · `DATABASE.md` §2.1

## 2.4 · `PasswordField` — `oNC08` ⚠️ **not** an `M/Field` instance

**Custom frame, because the label row carries a second element.**

```
oNC08  vertical, gap 7
├─ XypU5  Row · space_between · align center
│   ├─ Mf9cG  "PASSWORD"        mono 10.5 / 600 / ls 0.8 / $m-ink-2
│   └─ PlJvl  "Forgot password?" body 12 / 500 / $m-accent
└─ FBe3Q  Box · fill $m-surface · stroke $m-border 1 · padding [11,13]
    └─ o19cGH  "••••••••••"     body 13.5 / normal / $m-ink
```

```jsx
<div className="flex w-full flex-col gap-[7px]">
  <div className="flex w-full items-center justify-between">
    <label htmlFor="password" className="font-mono text-[10.5px] font-semibold
                                         uppercase tracking-[0.8px] text-[--color-ink-2]">
      Password
    </label>
    <button type="button" onClick={() => setMode('forgot')}
            className="font-body text-[12px] font-medium text-[--color-accent]
                       hover:text-[--color-accent-hover] hover:underline">
      Forgot password?
    </button>
  </div>
  <input id="password" type="password" autoComplete="current-password" required … />
</div>
```

**Build note** — extend `Field` with an optional `labelAction` slot rather than forking it. One component, two uses.
**onClick (Forgot password)** — **does not navigate.** Swaps the card body to `ForgotPasswordForm` in place. Your decision: *"we need to hide the signin component and show just email component."*
**Validation** — min 12 characters, no complexity rules (L052). **Never disclose the rule on the login form**, only on signup — stating it on login helps an attacker.
**Security** — `autoComplete="current-password"` on login, `"new-password"` on signup. Never log the value. Never send it anywhere but the auth endpoint.
**Refs** — T8.1 · T3.2 · T3.7 · L052 · L099

## 2.5 · `SignInButton` — `wn5CB` → **instance of `M/Button`** (`zK0k4`)

```
ref: zK0k4 · width fill_container
overrides: xRiX2.enabled = false (icon off) · LlNGk.content = "Sign in"
```

Inherited: fill `$m-primary` · padding [13, 22] · gap 8 · label body 13.5 / 600 / `letterSpacing 0.1` / `$m-primary-foreground` · optional lucide icon 16×16, **off here**.

```jsx
<button type="submit" disabled={loading || !canSubmit}
        className="inline-flex w-full items-center justify-center gap-2
                   bg-[--color-primary] px-[22px] py-[13px]
                   font-body text-[13.5px] font-semibold tracking-[0.1px]
                   text-[--color-primary-foreground]
                   hover:bg-[--color-primary-hover]
                   disabled:opacity-50 disabled:cursor-not-allowed
                   focus-visible:outline-2 focus-visible:outline-offset-2">
  {loading ? <Spinner /> : 'Sign in'}
</button>
```

**onClick** → `POST /api/auth/login` with `{ email, password }`. On 200, redirect to `/app/board` — or to the profile builder if `profile.completed_at` is null (L047).
**onHover** — `$m-primary` → `$m-primary-hover` (`#0F2439`). Both tokens exist; the transition duration doesn't. Use 150ms.
**Loading** — disabled + spinner + `aria-busy`. **Prevents double-submit**, which matters because a duplicate login creates a second session row.
**Errors** — ⚠️ **identical message for unknown-email and wrong-password.** Rendering the server's reason verbatim reintroduces enumeration. `SECURITY.md` §6 test #2.

**Performance / concurrency** — the component has none; the **endpoint** does:
- Argon2id is deliberately slow (~100ms, CPU-bound). 100 simultaneous logins on a small Railway container will queue.
- Rate limiting is Postgres-backed (T2.4) — one indexed read per attempt, `idx_auth_attempts`.
- **Mitigation is the rate limiter, not scaling.** 100 concurrent logins from distinct users is implausible at MVP scale; 100 from one IP is an attack, and the limiter stops it before Argon2 runs.

**DB** — reads `users`, writes `sessions` (`DATABASE.md` §2.1, §2.3).
**A11y** — `type="submit"` inside a `<form>` so Enter works. Never `<div onClick>`.
**Refs** — T8.1 · T3.2 · T2.1 · T2.4 · L044 · `SECURITY.md` G6

## 2.6 · `OrDivider` — `Jqb7r`

`gap 12` · two 1px `$m-border` rules filling · centre text "or" mono 11px `$m-muted`.
`aria-hidden` — purely visual.

## 2.7 · `SSOButtonGroup` — `E7ChO` ⚠️ **not** `M/Button`

Vertical, gap 12. **Both buttons are custom frames** — visually distinct from the primary button:

```
fill $m-surface · stroke $m-border-strong 1px · gap 10 · padding [11,16] · centred
Mark  18×18, brand colour, letter in display 10.5 / 700 / #FFFFFF
Label body 13.5 / 600 / $m-ink
```

| | Mark fill | Letter | Pen ID |
|---|---|---|---|
| Google | `#1A73E8` | "G" | `zO6Ei` |
| LinkedIn | `#0A66C2` | "in" | `Eguff` |

⚠️ **Brand colours are hardcoded, not tokens** — correct, they belong to Google and LinkedIn, not your palette.

### `GoogleSSOButton`

```jsx
<button type="button" onClick={startGoogleOAuth}
        className="flex w-full items-center justify-center gap-[10px]
                   border border-[--color-border-strong] bg-[--color-surface]
                   px-4 py-[11px] font-body text-[13.5px] font-semibold
                   text-[--color-ink] hover:bg-[--color-surface-2]">
  <span className="grid size-[18px] place-items-center bg-[#1A73E8]
                   font-display text-[10.5px] font-bold text-white">G</span>
  Continue with Google
</button>
```

**onClick** → full-page navigate to `GET /api/oauth/google/start`. **Not `fetch`** — OAuth requires a browser redirect.
⚠️ **The server generates `state` and PKCE** before redirecting (T4.1, `SECURITY-CONTROLS.md` §1). The client never constructs the OAuth URL.
**onHover** — `$m-surface` → `$m-surface-2`. Not in the file; proposed.
**Icon** — the design uses a letter tile, **not the Google logo**. Google's brand guidelines normally require their mark; worth checking before launch.
**DB** — callback writes `oauth_accounts`, may null `password_hash` (L069).
**Refs** — T8.2 · T4.1 · T4.2 · T4.3 · L068 · L069

### `LinkedInSSOButton` ⚠️ disabled in MVP

Identical structure, `#0A66C2`, "in".

```jsx
<button type="button" disabled title="Coming soon"
        className="… opacity-50 cursor-not-allowed" aria-disabled="true">
```

**Why disabled** — LinkedIn requires a verified company Page to create the OAuth app at all (L074). Not deferrable to staging; it blocks local development too.
⚠️ **`M/Button` defines no disabled state.** Using `opacity-50` by convention — **needs designer input**.
**Refs** — T8.2 · T4.4 (⏸) · L074 · C4

## 2.8 · `CreateAccountLink` — `rFBsB`

`gap 5`, centred. "New here?" body 13 normal `$m-ink-2` + "Create an account" body 13 **600** `$m-accent`.

**onClick** — swaps `mode` to `'signup'`. **Same route, same component.** A `<button>`, not an `<a>` — nothing navigates.

## 2.9 · `TermsNotice` — `NGO2v`

body 11.5 · `lineHeight 1.5` · centred · `$m-muted`
"By continuing you agree to the Terms and Privacy Policy."

⚠️ **Terms and Privacy must be real links to real pages** — F0-1.8. And **the Privacy page must disclose AI processing** (L057, L065): resumes and job descriptions are sent to Google's Gemini API. That's a legal requirement under DPDP, not a nicety.

---

# 3 · COMPONENTS THIS SCREEN NEEDS THAT AREN'T DRAWN

| Component | Why | Task |
|---|---|---|
| **`OtpInput`** | Verification renders **on this screen** — your decision. Six fields, paste distributes, expired vs incorrect read differently (L071) | T8.3 |
| **`ForgotPasswordForm`** | Replaces the card body in place. Always the same response regardless of account existence (G6). OTP → set password. **No temporary password by email** (L099) | T3.7 |
| **`ErrorSummary`** | Form-level errors above the fields, focus moved to it | T8.1 |
| **`Spinner`** | In-button loading | T8.1 |

**This screen is a state machine, not four routes:**

```
signin ⇄ signup
   ↓         ↓
   ↓      otp (after signup)
   ↓         ↓
forgot → otp → set-password
```

One route, one card, `mode` state. Matches your instructions for all three flows.

---

# 4 · OPEN — designer input

| | Question | Blocks |
|---|---|---|
| 1 | **Focus state** — not defined on any component. Accent ring, primary ring, or offset outline? | every input and button |
| 2 | **Disabled state** — `M/Button` has none. Needed for LinkedIn | T8.2 |
| 3 | **Error state** — no red-border variant on `M/Field` | all validation |
| 4 | **Corner radius confirmed square?** No `cornerRadius` on any node. Confirming this is intended, not omitted | all 21 primitives |
| 5 | Hover states — only `$m-primary-hover` and `$m-accent-hover` exist. Nothing for surfaces or fields | buttons, SSO |
| 6 | Transition durations — none specified. Proposing 150ms | all interactive |

---

# 5 · CORRECTIONS TO `FRONTEND-COMPONENTS.md`

Reading the source contradicted two things I'd inferred:

| | I said | Source says |
|---|---|---|
| **C-02 SSO buttons** | built on P-01 Button | **Separate custom frames** — `$m-surface` + `$m-border-strong`, not `$m-primary` |
| **Password field** | P-02 Input instance | **Custom frame** — the label row carries "Forgot password?", so it can't be a plain `M/Field` |
| Corner radius | `rounded-md` throughout | **No radius anywhere** — square |
| Icons | unspecified | **Lucide**, confirmed |

That file's structure holds; these four values don't.

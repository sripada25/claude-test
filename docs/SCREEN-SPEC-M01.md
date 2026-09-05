# SCREEN-SPEC-M01.md — Sign in / Create account

Full operational specification. Every functionality on this screen, traced field by field.

**Sources merged:** `SCREEN-NOTES-M01.md` (pen values) · `TASKS-FRONTEND_quarterfinal.md` (component contracts) · `INTERACTION-STATES.md` (focus/hover/error) · `DATABASE_quarterfinal.md` (schema) · `SECURITY_quarterfinal.md` (controls)

⚠️ **One value below is a proposal, not a pen-verified value** — the eye-icon toggle wasn't in any mockup. Marked where it appears.

---

# SCREEN

**Mockup:** `Mockup___01_Sign_in___Create_account.png` · pen source `D66lO`
**Route:** `/signin` (single route; `signup` and `forgot` are client-side states, not separate routes)
**GitHub Issue:** _(create per `ISSUES.md` before branching — link here once opened, e.g. `#12`)_

---

# RESOLUTION

## Breakpoints used on this screen

| Breakpoint | Width | Card behavior |
|---|---|---|
| Mobile | < 640px | Full-width card, no border on the viewport edges, padding `[24,20]` |
| `sm` | ≥ 640px | Card gets `max-w-[420px]`, centered, padding `[44,40]` (pen value) |
| `md` / `lg` / `xl` | ≥ 768px | No further change — this screen doesn't use the sidebar or app chrome |

## Screen resolution — browser (desktop)

**Design canvas:** 1440×900 (not fully utilized — card is centered in open space, background fills the rest).
**Practical target:** any viewport ≥ 640px renders identically; the card doesn't grow past 420px even on a 4K monitor. Background (`$m-bg` #F5F3EF) fills whatever space remains.

## Tablet resolution

**768–1023px:** identical to desktop behavior — card stays centered at 420px max-width. No tablet-specific layout exists on this screen; it's the same as the `sm`+ desktop case.

## Mobile resolution

**< 640px:** card becomes full width minus 20px side margins. Vertical spacer gaps (see below) stay the same in px — they don't scale down, since none of them are large enough to cause a problem on a small screen.

## Screen background

`bg-[--color-bg]` → `#F5F3EF`, full viewport, `min-h-screen`. No image, no gradient, no pattern — flat fill.

```jsx
<div className="min-h-screen bg-[--color-bg] flex items-center justify-center px-5 py-10">
```

---

# TASKS LIST

From `TASKS-FRONTEND_quarterfinal.md`, this screen's scope:

| Task ID | Component | Local-complete? |
|---|---|---|
| M01-01 | AuthCard (container) | ✅ |
| M01-02 | AuthHeading | ✅ |
| M01-03 | EmailField | ✅ |
| M01-04 | PasswordField | ✅ |
| M01-05 | SignInButton | ✅ |
| M01-06 | OrDivider | ✅ |
| M01-07 | GoogleSSOButton | ⚙️ redirect URI differs at deploy |
| M01-08 | LinkedInSSOButton | ⏸ blocked on L074 |
| M01-09 | OtpInput | ⚙️ email transport differs at deploy |
| M01-10 | ForgotPasswordForm | ⚙️ same |
| M01-11 | CreateAccountLink | ✅ |
| M01-12 | TermsNotice | ✅ |

Backend dependencies (from `TASKS_quarterfinal.md`) this screen calls into: **T3.1** signup · **T3.2** login · **T3.5** OTP · **T3.7** forgot-password · **T4.1–T4.3** Google OAuth · **T2.3** session middleware (every call passes through it).

---

# DATABASE SCHEMA — every write this screen produces

| Field entered on screen | Table.column | Type | Constraint |
|---|---|---|---|
| Email | `users.email` | `CITEXT` | `UNIQUE NOT NULL` |
| Password | `users.password_hash` | `TEXT` | nullable (SSO users), Argon2id — **the plaintext value itself is never stored** |
| — (system-set) | `users.timezone` | `TEXT` | captured from browser at signup, not user-entered |
| — (system-set) | `users.email_verified_at` | `TIMESTAMPTZ` | NULL until OTP confirms |
| OTP code | `verification_tokens.token_hash` | `TEXT` | hashed, matched not stored raw |
| — (system-set) | `sessions.token_hash` | `TEXT` | issued on successful login/signup |
| — (system-set, Google) | `oauth_accounts.provider_user_id` | `TEXT` | the OIDC `sub`, never the email |

**Tables this screen touches, in order of a full signup flow:** `users` → `profiles` (shell row) → `subscriptions` (trial init) → `generation_quota` → `sessions` → `verification_tokens`.

**Full reference:** `DATABASE_quarterfinal.md` §2.1–§2.6.

---

# API CALLS — every request this screen makes

| Trigger | Endpoint | Method | On success |
|---|---|---|---|
| Sign In button | `/api/auth/login` | POST | → see OnSuccess below |
| Create Account submit | `/api/auth/signup` | POST | → OTP state (same screen) |
| Google button | `/api/oauth/google/start` | GET (full navigate) | → Google's consent screen, then our callback |
| OTP auto-submit (6th digit) | `/api/auth/verify` | POST | → see OnSuccess below |
| Resend code | `/api/auth/resend-verification` | POST | → toast "Code sent", cooldown starts |
| Forgot password submit | `/api/auth/forgot-password` | POST | → OTP state, `mode='forgot'` |
| Set new password | `/api/auth/set-password` | POST | → `/app/board` |

---

# ON SUCCESS — where the user goes next

This is the part your outline specifically asked for, and it branches:

```
Login success
   ↓
   profile.completed_at IS NULL?
        YES → /app/profile  (Profile builder, M02 — mandatory, L047)
        NO  → /app/board    (Pipeline board, M03)

Signup success
   ↓
   Always → OTP state (stays on THIS screen, mode='otp')
        ↓ on correct OTP
        → /app/profile  (M02 — every new user has an incomplete profile)

Google OAuth success (callback)
   ↓
   New account created (first-time Google sign-in)?
        YES → /app/profile
        NO, existing account → same branch as Login success above

Forgot password → set new password success
   ↓
   → /app/board  (they're already an existing, presumably complete, user)
```

⚠️ **Every "success" path that creates a new user goes to Profile, never straight to Board** — this is L047 enforced at the routing level, not just a UI suggestion.

---

# FRONTEND COMPONENT REFERENCE

This screen is a composition of:

- **1 container** — `AuthCard`, which internally manages a `mode` state machine (`signin | signup | otp | forgot`)
- **1 heading** — `AuthHeading`, content swaps per `mode`
- **2 form fields** — `EmailField` (true `Field` instance), `PasswordField` (custom, `labelAction` slot)
- **1 primary button** — `SignInButton` (label swaps to "Create account" in signup mode)
- **2 SSO buttons** — `GoogleSSOButton`, `LinkedInSSOButton` (disabled)
- **1 divider** — `OrDivider`
- **1 six-digit input** — `OtpInput` (renders only in `otp` mode)
- **1 alternate form** — `ForgotPasswordForm` (renders only in `forgot` mode, replaces the email+password+SSO block)
- **2 text links** — `CreateAccountLink`, and "Forgot password?" (part of `PasswordField`'s label row)
- **1 legal notice** — `TermsNotice`

No tabbed component — mode switching is a single card with content substitution, not tabs with independent panels.

---
---

# COMPONENT-BY-COMPONENT — every functionality, every state

## AuthCard (container)

**onMode change:** cross-fades content (`transition-opacity duration-200`), moves focus to the new heading for screen readers, clears any field errors from the previous mode.

**Vertical spacing (pen-verified, do not approximate):**

| Gap | px | Between |
|---|---|---|
| 1 | 28 | brand → heading |
| 2 | 6 | heading → subtitle |
| 3 | 26 | subtitle → form |
| 4 | 22 | form → divider |
| 5 | 22 | divider → SSO |
| 6 | 26 | SSO → rule |
| 7 | 18 | rule → "New here" |
| 8 | 22 | "New here" → terms |

```jsx
<main className="mx-auto w-full max-w-[420px] border border-[--color-border] bg-[--color-surface] px-10 py-11 sm:px-10 sm:py-11 max-sm:px-5 max-sm:py-6">
```

---

## Email — Label

**Content:** "EMAIL" · **Tailwind:** `font-mono text-[10.5px] font-semibold uppercase tracking-[0.8px] text-[--color-ink-2]`
**Transitions:** none — labels don't animate.

## Email — Input box

**Type:** `type="email"` · **Tailwind (rest state):**
```
w-full border border-[--color-border] bg-[--color-surface] px-[13px] py-[11px]
font-body text-[13.5px] text-[--color-ink] placeholder:text-[--color-muted]
```

**onClick / onFocus:** border changes to `--color-primary`, plus a focus ring:
```
focus:border-[--color-primary] focus:outline-2 focus:outline-offset-0 focus:outline-[--color-primary]
```
No offset on the ring here — an offset ring around an already-bordered input reads as a double border. Transition: `transition-colors duration-150`.

**onHover (not focused):** no defined hover treatment on inputs in the source file — border stays as-is. (Distinct from buttons, which do have a hover state.)

**onBlur:** validation runs here, not while typing. Checks non-empty and contains `@`.

**onError:**
```
aria-[invalid=true]:border-[--color-danger]
aria-[invalid=true]:focus:outline-[--color-danger]
```
Border turns from `--color-border` (#DBD5C9) to `--color-danger` (#AE3B2C). An error message renders below in `text-[12px] text-[--color-danger]`, tied to the input via `aria-describedby`.

**Input data sent to:** `users.email` (`CITEXT`) — via the JSON body of `/api/auth/login` or `/api/auth/signup`, never a query string, never the URL.

---

## Password — Label + action

**Content:** "PASSWORD" mono, plus "Forgot password?" body `12`/500 `$m-accent` sharing the same row (`justify-between`).

**Forgot password onClick:** does **not** navigate. Calls `setMode('forgot')` — swaps the card body in place, same route.

## Password — Input box

**Type:** `type="password"` by default — **text is masked as dots**, standard browser behavior, no custom rendering needed for the masking itself.

### ⚠️ Eye icon toggle — proposed, not in any mockup

You asked for this specifically; it isn't drawn anywhere in the source file. Building it as a reasonable addition, flagged for designer confirmation:

```jsx
const [visible, setVisible] = useState(false);

<div className="relative">
  <input type={visible ? 'text' : 'password'} … className="… pr-10" />
  <button type="button" onClick={() => setVisible(v => !v)}
          aria-label={visible ? 'Hide password' : 'Show password'}
          className="absolute right-3 top-1/2 -translate-y-1/2 text-[--color-muted]
                     hover:text-[--color-ink-2] transition-colors duration-150">
    {visible ? <EyeOff size={16} /> : <Eye size={16} />}
  </button>
</div>
```

**Behavior:**
- **Closed (default):** input shows masked dots, icon is the "eye" (closed/crossed-out state) — clicking it reveals
- **Open (clicked):** `type` switches to `text`, dots become the actual characters typed, icon becomes "eye-off" — clicking again re-masks
- **No transition on the text itself** — masking/unmasking is instant, not animated (animating password characters risks a visible flicker of characters mid-transition, which is a minor information leak)
- **Never toggles `autoComplete`** — stays `current-password`/`new-password` regardless of visibility state
- **Icon button, not part of tab order disruption** — `tabIndex` follows naturally after the input, doesn't jump focus

**onError:** identical pattern to email — border → `--color-danger`, message below. **Never states which rule failed on the login form** (no "must be 12 characters" hint on login — that information is only shown on the signup form, since revealing it to a failed-login attempt helps an attacker narrow the search space).

**Input data sent to:** `users.password_hash` — but not directly. The **plaintext value is sent once over HTTPS to the API**, hashed server-side with Argon2id, and the hash is what's stored. The plaintext never appears in a log, a database column, or an error message at any point.

---

## SignInButton

**Tailwind (rest):**
```
inline-flex w-full items-center justify-center gap-2 bg-[--color-primary]
px-[22px] py-[13px] font-body text-[13.5px] font-semibold tracking-[0.1px] text-white
```

**onClick:** submits the form (`type="submit"`, so Enter also triggers it) → `POST /api/auth/login` with `{ email, password }`.

**onHover:** `bg-[--color-primary]` → `bg-[--color-primary-hover]` (#0F2439), `transition-colors duration-150`.

**onFocus:** `focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[--color-primary]` — note `focus-visible`, not `focus`, so the ring only shows for keyboard navigation, not a mouse click.

**Loading state (mid-request):** button disables, label replaced by a spinner, `aria-busy="true"`. This **prevents double-submit** — clicking twice while a request is in flight would otherwise risk creating two session rows.

**Form failure:** ⚠️ **one identical, generic error message regardless of cause.** Unknown email and wrong password produce the exact same text and roughly the same response time — this is deliberate (`SECURITY_quarterfinal.md` §8), not an oversight. The error never attaches to a specific field; it renders as a form-level banner above the fields.

---

## Sign In using Google SSO — full functionality

**Trigger:** `GoogleSSOButton` onClick.

**Not a fetch call — a full browser navigation:**
```js
window.location.href = '/api/oauth/google/start';
```
OAuth requires the browser itself to redirect to Google's consent screen; an `XHR`/`fetch` call can't do this.

**What happens server-side before the redirect:** the server generates a random `state` value and a PKCE `code_verifier`, stores both in the `oauth_states` table (10-minute expiry), sets them in a short-lived cookie, then redirects to Google with that `state` attached.

**User leaves your app entirely** — sees Google's own consent screen, picks or confirms their Google account, grants (or denies) access.

**Google redirects back** to `/api/oauth/google/callback?code=...&state=...`.

**Server-side, on callback:**
1. Verifies the returned `state` matches what was stored — mismatch means reject the login outright (this is the defense against session hijacking via forged OAuth flows)
2. Exchanges the authorization `code` for Google's identity token using the stored PKCE `code_verifier`
3. Reads the user's **name and email only** — no other Google data is requested or received
4. Checks if an account with that email already exists:
   - **Exists, and was verified via password OTP already:** links the Google identity to it, both login methods now work
   - **Exists, but was never verified:** links Google, and **invalidates the old password** (forces reset) — this closes a takeover scenario where someone registered that email with a password they don't actually own
   - **Doesn't exist:** creates a new account, `email_verified_at` set immediately since Google already verified it
5. Issues a session, redirects to `/app/profile` (new account) or the appropriate board/profile route (existing account, per the OnSuccess table above)

**onHover:** button background `$m-surface` → `$m-surface-2` (#EFEBE3).

**If Google denies or the flow errors:** redirected back to `/signin` with a generic error banner — never a message that leaks which specific step failed.

---

## OTP input — six digits

**Rendered only when `mode === 'otp'`.** Not a separate route.

**Each of the six boxes:** `size-11 border border-[--color-border] bg-[--color-surface] text-center font-mono text-[16px]`, `inputMode="numeric"` so mobile shows a numeric keypad.

**onType:** auto-advances to the next box. **Backspace on an empty box:** moves focus to the previous one.

**onPaste (anywhere in the group):** distributes the pasted 6-digit string across all six boxes automatically.

**Auto-submit:** fires `POST /api/auth/verify` the instant the sixth digit is entered — no separate submit button needed.

**onError — two distinct messages, never merged into one:**
- Code expired (past 10 minutes): *"Code expired — send a new one"*
- Wrong code: *"Incorrect code — 3 attempts remaining"* (counts down each attempt)
- 5th wrong attempt: locks — *"Too many attempts. Request a new code."*

**Resend:** visible cooldown timer, capped at 3 sends per hour.

---

## Create Account link

**Content:** "New here? **Create an account**" — the bold portion is `$m-accent`.

**onClick:** `setMode('signup')`. This is a `<button>`, not an `<a href>` — nothing navigates, it's a pure client-side state change on the same screen.

**In signup mode, the form itself is identical** to sign-in (same Email and Password fields, same components) — only the heading text and the submit button's label and destination endpoint change.

---

## Terms notice

Static text, two real links (`/terms`, `/privacy`) — F0-1.8, not yet built. `text-[11.5px] text-center text-[--color-muted]`.

---

# SECURITY NOTES SPECIFIC TO THIS SCREEN

- Login never reveals whether an email exists — identical response, comparable timing
- Signup, separately, also never reveals it — an existing address gets a "someone tried to sign up with your address" notification email instead of a form error
- Every field's data goes in the request body, never a URL parameter
- Rate limiting applies to both login and signup attempts, keyed by IP (via `T7.5`'s proxy-aware resolver) and by email
- CSRF token required on every POST from this screen

---
---

# CONFIRM THE FORMAT

If this depth and structure is what you want, I'll produce M02 through M06 identically — each will be roughly this length, since each screen has a comparable number of distinct components and states.

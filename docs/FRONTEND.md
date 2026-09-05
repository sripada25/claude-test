# FRONTEND.md — Trackr

React 19 · TypeScript · Tailwind CSS 4. **No component library** (L020).

⚠️ **Conventions are settled; specific screens are not.** Wireframes pending — do not build UI ahead of them.

---

# 1 · THE RULE THAT MATTERS MOST

**Components never contain business logic.** They call `/api/*` endpoints and render the result.

No database access, no service imports, no business rules in a component or page. If a mobile client couldn't reproduce the behaviour by calling the same endpoint, the logic is in the wrong place (L018).

# 2 · STRUCTURE

```
/app
  /(auth)/{login,signup,verify}/page.tsx
  /(app)/{profile,applications}/page.tsx
/components
  /ui        Button, Input, Select, Badge — hand-built primitives
  /forms     ProfileForm, SignupForm
  /layout    Header, Nav
/hooks       useSession, useProfile
/lib/api     typed fetch wrappers, one per endpoint
```

# 3 · STATE

| Kind | Tool |
|---|---|
| Server data | `fetch` in a hook, cached in React state |
| Form state | `useState` — no form library in MVP |
| Session | One `useSession` hook reading `GET /api/auth/session` |
| UI state | Local `useState` |

No Redux, Zustand, or React Query in MVP. Add one only when a concrete problem demands it.

# 4 · SECURITY

**Route guards are UX, not authorization.** Every protected endpoint enforces auth server-side independently. A client-side redirect is a convenience, never a control.

- Never store tokens in `localStorage` — the session cookie is httpOnly and JS-invisible by design
- Never `dangerouslySetInnerHTML` on user content
- Never render server error details verbatim
- Include the CSRF token on state-changing requests (T7.2)

# 5 · TAILWIND 4

CSS-first configuration via `@theme` in the global stylesheet. Define design tokens there — colours, spacing, typography — and use utilities in components. No separate config file needed for basics.

Build primitives in `/components/ui` and reuse. Hand-built beats a library here: smaller bundle, no version churn, no fighting someone else's abstractions.

# 6 · FORMS

- Labelled inputs, always — `<label htmlFor>`, not placeholder-as-label
- Inline validation on blur, not on every keystroke
- Disable submit while in flight; show a pending state
- Warn on navigate-away with unsaved changes (the profile form is long)
- Errors announced to screen readers via `aria-live`

# 7 · THE REVIEW SCREEN (T8.4)

The resume-parse review step is the one screen where design matters more than the rest combined. Parse output is **never saved blind** (L049) — this screen is the control that makes AI extraction safe.

Every extracted field must be visibly editable, and it must be obvious the data came from the upload and needs checking.

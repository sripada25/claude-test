# SCREEN-NOTES-ADMIN.md — Admin Console

Pen source: `Admin.pen` · read 2026-08-27. Two mockups exist: **Admin 01 Sign in** (`AdzqV`), **Admin 02 Dashboard** (`wnV4Q`), sharing **`M/Sidebar — Admin`** (`dhVeK`).

**This resolves the interaction-state questions I'd flagged as open.** The design file now has explicit state variants: `M/Button — Focus`, `M/Button — Disabled`, `M/Field — Focus`, `M/Field — Disabled`, `M/Field — Error`, `M/Checkbox — Focus`, `M/Checkbox — Disabled`. Read these before touching `INTERACTION-STATES.md` — they're no longer proposals, they're specified.

---

# 1 · ADMIN NAV — 7 sections, 15 items

🎨 From `dhVeK`, exact order:

| Section | Items |
|---|---|
| **ADMIN** | Dashboard |
| **WORKSPACE** | Users · Plans & Tiers · Usage & Quotas |
| **AI** | AI / Gemini · API Keys |
| **BILLING** | Billing · Payments |
| **SECURITY** | Security · Audit Logs |
| **SYSTEM** | Feature Flags · System Health · Settings |
| **ADMINISTRATION** | Admin Users · Roles & Permissions |

**This maps directly to what you asked for**, and adds two you didn't name explicitly: **Feature Flags** and **Audit Logs** as first-class sections, not folded into Security.

🎨 Section headers: mono `9`/600, `letterSpacing 1.2`, `$m-sidebar-muted`, with a rule — visually distinct from the main app sidebar's flat list.
🎨 Sidebar itself: identical structure to `M/Sidebar`, plus **"ADMIN CONSOLE"** subtitle under the wordmark — mono `8.5`/600, `letterSpacing 1.1`, `$m-accent`.
🎨 User row shows **role**, not plan: "Super admin" — mono, where the main app shows "Free plan"/"Pro trial".

**This confirms role-based display is already a designed pattern**, not something to invent — the main sidebar shows plan, the admin sidebar shows role. Same slot, different content by context.

---

# 2 · ADMIN SIGN-IN — three things beyond a normal login

## 2.1 · MFA is mandatory, not optional

🎨 Three fields: Work email · Password · **Authenticator code** (6-digit, placeholder shown, mono).

⚠️ **This is a real security decision embedded in the design, not a note.** Admin login requires TOTP on every sign-in — no admin session exists without it. This needs its own schema (`admin_users.totp_secret`, likely a separate enrollment flow) and its own task group; it cannot reuse F1's OTP-for-verification flow, which is single-use and email-delivered, not app-based TOTP.

## 2.2 · Environment awareness is shown to the admin, at login

🎨 Card footer: `env: production` · `region: ap-south-1` · `v2.4.0` — mono `10.5`, `$m-muted`.

⚠️ **An admin must be able to tell which environment they're authenticating into before they act.** Worth building this from real `NODE_ENV`/deploy metadata, not hardcoded — the entire point is preventing an admin from mistaking staging for production (or vice versa) at the moment of highest consequence.

## 2.3 · Every attempt is disclosed as logged

🎨 "Audit notice" panel, left-accent stroke, shield-alert icon: *"Every sign-in attempt is recorded to the audit log with IP and device."*

**This is already true in our design** — `security_events` captures exactly this (L080). The admin screen is the first place we've been asked to *disclose* it to the user at the point of action, which is good practice and costs nothing since the data already exists.

## 2.4 · SSO is domain-restricted

🎨 Button reads **"Continue with Google Workspace"**, not the consumer "Continue with Google" from M01.

⚠️ **Different OAuth configuration from F1's consumer SSO** — this implies domain-restricted sign-in (`hd` parameter in Google's OAuth flow, restricting to your organization's Workspace domain), not open Google sign-in. A separate `AdminOAuthAdapter`, or a parameterised version of `GoogleAdapter` — not the same code path as customer-facing SSO, since the security model is different (anyone with a Google account vs. only your organization's Workspace accounts).

## 2.5 · "RESTRICTED" badge

🎨 Top strip: lock icon + "RESTRICTED" mono `8.5`/600, on `$m-sidebar-2`. Purely a visual signal that this is not the customer-facing sign-in — worth keeping as a permanent visual distinction across every admin screen, not just this one.

---

# 3 · ADMIN DASHBOARD

## 3.1 · Top bar — distinct from the app's top bar

🎨 Search (280px, placeholder "Search users, plans, invoices…") · **environment chip** (`PRODUCTION`, success-soft, dot + label) · notification bell · admin identity with role shown.

⚠️ **The environment chip persists past login** — every admin page carries a visible "which environment am I in" signal, not just the sign-in screen.

## 3.2 · KPI row — four cards, exact metrics

🎨 **Total Users** `12,480` · **Active Subscriptions** `3,914` · **MRR** `₹18.6L` · **AI Generations · 24h** `27,310` — each with a delta indicator (up/down, not yet fully read).

**This directly answers your "gemini quota, plan limits" requirement** — AI generation volume is a top-level KPI, not buried in a report. It's a direct read from `ai_usage` (L097), which already exists.

## 3.3 · System health panel — five services, live status

🎨 Fixed list, each row: status dot, service name, **latency**, status badge:

| Service | Latency | Status |
|---|---|---|
| API Gateway | 42ms | OK |
| PostgreSQL | 8ms | OK |
| **Gemini API** | **1.4s** | **DEGRADED** (warning colour) |
| Razorpay webhooks | 120ms | OK |
| Email provider | 240ms | OK |

⚠️ **This is a monitoring dashboard, not a static status page.** It implies a health-check poller hitting each dependency and recording latency — genuinely new backend work, not a read of existing tables. `T9.1`'s health endpoint checks *our* app; this checks *dependencies*, which is a different and larger task.

⚠️ **The Gemini row being shown degraded, deliberately, in the mockup** is worth noting — the designer is showing you what a real incident looks like on this screen, which suggests this panel's whole purpose is catching exactly the kind of Gemini slowdown that `SECURITY_quarterfinal.md` and `AI-RULES.md` already worry about (rate limits, per-minute burst).

## 3.4 · Audit log panel — five example events, and they tell you the schema

🎨 Each event: coloured left tick (by category), action name, **mono detail line**, timestamp.

| Action | Detail | Tick colour |
|---|---|---|
| Plan limits updated | "Free tier · 5 → 8 generations" | primary |
| Feature flag enabled | "ai_resume_v2 · 25% rollout" | violet |
| Refund issued | "INV-3391 · ₹1,499" | accent |
| **Admin role granted** | "dev@trackr.app → Support" | **danger** |
| API key rotated | "gemini_prod" | ink-2 |

**This is extremely informative for `admin_audit_log`'s schema** — it tells you the exact shape of an event: an action verb, a structured one-line detail (often "before → after"), a category-driven colour, a timestamp. This should directly inform the `admin_audit_log` table structure — likely `action TEXT`, `detail TEXT`, `category ENUM`, `admin_user_id`, `created_at`, separate from the existing customer-facing `security_events`.

⚠️ **"Admin role granted" is coloured `$m-danger`** — the only red tick among five. The designer is signalling that granting admin access is the highest-severity category of action on this entire screen. Worth carrying into whatever alerting rule you build for this table — a role grant should probably alert immediately, the way `SECURITY_quarterfinal.md` §10 already does for `password_invalidated_by_oauth_link`.

⚠️ **Feature flags have percentage rollout** ("25% rollout") — not a simple on/off. This is a genuinely more sophisticated feature-flag system than a boolean, and it changes the schema (`rollout_percentage INT`, not `enabled BOOLEAN`).

## 3.5 · Signups chart + Recent signups table

🎨 Present, structure read but internals not fully expanded (bar chart with axis, and a data table). Standard reporting components — lower priority to read in full detail than the panels above, since their shape (a time-series chart, a paginated table) is generic.

---

# 4 · WHAT THIS CHANGES ABOUT THE ADMIN PANEL SCOPE

Compared to what you originally described, the mockup adds:

| You asked for | The mockup adds |
|---|---|
| Gemini quota control | **Live latency monitoring** on Gemini specifically, shown as a health signal, not just a config value |
| Free/Pro tier limits | Feature flags with **percentage rollout**, a materially bigger feature than tier limits alone |
| API key management | **Key rotation** as a tracked, audited action — not just storage |
| Security logs | A **structured, categorized, coloured** audit feed — richer than a flat log table |
| User management, role-based control | **MFA-gated admin login**, **domain-restricted SSO**, and role changes flagged as the highest-severity audit category |
| Payment controls | Split into **Billing** and **Payments** as separate sections — likely subscription management vs. transaction/refund handling |

**The scope is larger and more specific than the conversational request** — this is good; it means the design work already resolved ambiguities I would otherwise have had to ask you about (MFA yes/no, flag rollout percentages, audit event taxonomy).

---

# 5 · OPEN — before task decomposition

| | Question |
|---|---|
| 1 | **TOTP enrollment flow** — where does an admin set up their authenticator? Not shown in either mockup |
| 2 | Is `M/Sidebar — Admin`'s "ADMINISTRATION" section (Admin Users, Roles & Permissions) itself gated — can a Support-role admin see it, or only Super admin? |
| 3 | System Health — polling interval? Who gets alerted on DEGRADED, and how? |
| 4 | Feature flag rollout — percentage of what population? All users, or per-tier? |
| 5 | Audit log retention — same 90-day question as `auth_attempts`, or does an audit trail need longer, possibly indefinite, retention given it covers admin actions? |
| 6 | Are Billing and Payments genuinely separate admin capabilities, or one feature split across two nav items for scanability? |

---

# 6 · NEXT

This screen-notes file is new — it hasn't been folded into `TASKS_quarterfinal.md`, `DATABASE_quarterfinal.md`, or `PRODUCT-REFERENCE_quarterfinal.md` yet. Admin panel work was deliberately deferred per your instruction; this document exists so nothing from the mockup is lost before that work starts.

**When you're ready to scope the admin panel task list**, this is the starting point — it now has a real design to build tasks against, rather than a conversational description.

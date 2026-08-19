# Architecture

System shape, data model, and the generation pipeline for the Trackr web
app. See [AGENTS.md](../AGENTS.md) §0 for why this diverges from the
original planning PDFs.

Most of the product is not AI. User accounts, application records,
pipeline stages, follow-up reminders, and document storage are a
database and a UI. The AI generation step is one API call per document.
The job search intelligence system around it is the product.

## System shape

```
Browser (web)              Expo app (Android, iOS later)
    |                              |
    | HTTPS / JSON                | HTTPS / JSON
    v                              v
        Node.js + TypeScript backend (Express)
                    |
    +---------------+----------------+
    |                                |
    v                                v
PostgreSQL (Railway)          External services
                               - Google OIDC
                               - Gemini Flash (AI generation)
                               - Razorpay / Stripe
                               - Email provider
```

One backend, one database, two clients. The web app and the mobile app
never talk to each other directly or share local state — everything
goes through the API, so an application logged on the phone appears on
the web tracker on next load with no special sync logic.

## Production hosting

```
Internet
    |
    v
Railway
    |
    +-- frontend service   (static build, served by Railway)
    |
    +-- backend service    (Node.js API)
    |
    +-- PostgreSQL service (Railway-managed)
```

Frontend and backend are logically independent services even though
they deploy from the same repository — do not let them import from each
other's source directly. All communication is over the HTTP API.

## Frontend

- React + TypeScript + Tailwind CSS, built with Vite
- No third-party UI component libraries — see README.md
- Strict TypeScript configuration (`strict: true`, no implicit `any`)
- Environment-specific configuration via Vite's `.env` handling
- Accessible, semantic HTML5; responsive by default
- Client-side validation is a UX convenience only

**The frontend is never a trusted security boundary.** Anything sent by
the browser must be treated as attacker-controlled by the backend.
Never rely on a disabled button, hidden UI, frontend role checks,
frontend validation, or frontend pricing/permission calculations for
security — the backend independently validates authorization, input,
state transitions, and payment status on every request.

## Backend

- Node.js + TypeScript
- REST API (see `docs/DEPLOYMENT.md` for endpoint conventions)
- Layered structure: routes → controllers → services → repositories,
  with centralized auth middleware, schema validation, error handling,
  and structured logging (see AGENTS.md §4 for the folder layout)
- Configuration comes from environment variables, never hardcoded

## Data model

The application record is the primary object. Everything connects to it.
This is carried over from the product specification with field names
adjusted to concrete Postgres columns — see `docs/DATABASE.md` for the
actual DDL.

| Entity | Purpose | Key fields |
|---|---|---|
| **users** | Account + profile | email, name, skills, experience_level, target_role, salary_expectation, location_preference |
| **auth_identities** | Login methods attached to a user | provider (local/google), provider_user_id, password_hash (local only) |
| **applications** | One job application | company, role, jd_text, date_applied, status, source_url |
| **documents** | A generated resume or cover letter | application_id, kind, file_path, generated_at, jd_snapshot |
| **call_logs** | A recruiter call, from either client | application_id, transcript_text, extracted_facts (jsonb), recording_deleted |
| **reminders** | A follow-up or prep nudge | application_id, due_date, type, status |
| **subscriptions** | Billing state | user_id, tier, billing_cycle, payment_provider, renewal_date |

A user can have multiple `auth_identities` (email/password and Google)
attached to the same account — see `docs/AUTHENTICATION.md` for the
linking rule. `call_logs` is written by whichever client captured the
call; on Android this comes from the (later) call-recording pipeline
in the mobile app, on web it comes from the manual three-question quick
log. Both write to the same table through the same API endpoint.

## Generation pipeline — cover letter / resume

1. User saves an application with the JD text pasted in
2. User requests cover letter or resume generation
3. Backend fetches the user's profile
4. Backend constructs the prompt: profile + JD + output format instruction
5. Gemini Flash generates the tailored document
6. Document stored, linked to the application record
7. Generation count incremented against the user's monthly limit

Never trust a client-reported generation count — the backend enforces
the free-tier limit (5/month) server-side before calling the AI
provider, not after.

## Call intelligence — where the web app fits in

Full call recording is a mobile-app (Android) feature and is out of
scope for this repository — see README.md's platform scope table. What
the web app does own:

- The **manual quick log**: after a call, the user answers three
  questions (who called, what was discussed, what is the next step) and
  the backend structures the answer into a `call_logs` row via the AI
  provider — same table, same downstream reminder logic as the
  eventual Android pipeline
- Reading and editing any `call_logs` row, regardless of which client
  created it

# SUPPORT.md — Trackr

Minimal support for MVP. No ticketing system, no admin UI, no live chat.

Answers: *"a paying user says their generation failed — where do I look?"*

---

# 1 · THE CHANNEL

**Support email address** (`support@<domain>`) + a contact form on the marketing site that posts to it. Two tasks in F0. That's the whole intake.

Users reach it from Settings and the marketing footer.

---

# 2 · WHERE TO LOOK — Railway's query console

**Not psql from a laptop.** L064 says no production credentials in developer environments, and that holds — distributing a `DATABASE_URL` to diagnose one failed generation is a bad trade.

**Railway's dashboard has a built-in query console.** It authenticates through the Railway account, so no credentials are copied anywhere, access is revocable, and there's an audit trail on the platform side.

For a self-hosted VPS instead, the equivalent is `docker compose exec postgres psql` over SSH — same principle: no credentials leave the server.

---

# 3 · DIAGNOSTIC QUERIES

Everything below reads `ai_usage` (L097), `generation_jobs` (L091), and `security_events`. **None of them return prompt contents or generated documents.**

## A user says their generation failed

```sql
SELECT j.id, j.type, j.status, j.attempts, j.error_class,
       j.created_at, j.completed_at
FROM generation_jobs j
JOIN users u ON u.id = j.user_id
WHERE u.email = 'user@example.com'
ORDER BY j.created_at DESC
LIMIT 20;
```

`error_class` tells you which of L096's branches it hit — transient (retried, should have recovered) or permanent (400, safety block, validation).

## Did it cost them a generation?

```sql
SELECT period_start, used FROM generation_quota q
JOIN users u ON u.id = q.user_id
WHERE u.email = 'user@example.com'
ORDER BY period_start DESC LIMIT 3;
```

Cross-check against failed jobs. Quota should be **refunded on failure** (L092) — if it wasn't, that's a bug and a refund owed.

## Is this failing for everyone, or just them?

```sql
SELECT date_trunc('hour', created_at) AS hour,
       status, error_class, count(*)
FROM ai_usage
WHERE created_at > now() - interval '24 hours'
GROUP BY 1, 2, 3
ORDER BY 1 DESC;
```

A spike in one `error_class` across many users is a provider incident or a bug — not a support case.

## What are we spending?

```sql
SELECT date_trunc('day', created_at) AS day,
       count(*) AS calls,
       sum(cost_estimate) AS usd,
       count(*) FILTER (WHERE status = 'failed') AS failures
FROM ai_usage
WHERE created_at > now() - interval '30 days'
GROUP BY 1 ORDER BY 1 DESC;
```

This is the cost-controller panel you wanted, as a query. Two SQL statements answer what an admin UI would show — which is why the UI is deferred to F7 (L097).

## Heaviest users — fair-use check

```sql
SELECT u.email, count(*) AS generations, sum(a.cost_estimate) AS usd
FROM ai_usage a JOIN users u ON u.id = a.user_id
WHERE a.created_at > now() - interval '30 days'
GROUP BY u.email ORDER BY generations DESC LIMIT 20;
```

Anyone near L093's 300/month ceiling is either a power user worth talking to or abuse worth investigating.

## Can't log in

```sql
SELECT event_type, ip, created_at, metadata
FROM security_events e
LEFT JOIN users u ON u.id = e.user_id
WHERE u.email = 'user@example.com'
ORDER BY created_at DESC LIMIT 20;
```

Shows rate-limit trips, OTP lockouts, and `password_invalidated_by_oauth_link` (L069) — the last one being the most common confusing case: their password stopped working because they signed in with Google on an unverified account.

---

# 4 · WHAT YOU MUST NEVER QUERY FOR SUPPORT

**Do not read:**
- `documents.content` — the generated letter or resume
- `applications.job_description`
- `profiles` beyond confirming `completed_at IS NOT NULL`
- Anything from a resume upload

**Diagnosis needs `error_class`, timestamps, and status. Never content.** L064 commits to purpose limitation; reading a user's cover letter to debug a 400 error breaks that for no diagnostic gain.

If a user *asks* you to look at their document, that's their consent — note it in the ticket thread.

---

# 5 · ESCALATION

| Signal | Action |
|---|---|
| One user, one failure, `error_class` transient | Tell them to retry; the queue should have handled it — check why it didn't |
| One user, repeated permanent failures | Likely their input — empty JD, safety-filter trip. Check `error_class` |
| Many users, same `error_class`, same window | Provider incident or a deploy regression. Check `ai_usage` by hour |
| Cost spike with no signup spike | Someone is near the fair-use ceiling, or `Regenerate` is being clicked more than modelled |
| Any `oauth_state_mismatch` | **No legitimate cause.** Investigate as a security event, not support |

---

# 6 · WHEN THIS STOPS BEING ENOUGH

Move to F7's admin panel when: support volume exceeds a few queries a week, someone non-technical needs access, or you want alerting rather than looking.

**Two rules already binding on that panel (L097):**
- **Aggregates only** — cost, counts, failure rates, latency percentiles
- **Never prompt contents or generated documents**

Until then, these queries are the panel.

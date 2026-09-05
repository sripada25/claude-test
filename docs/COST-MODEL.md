# COST-MODEL.md — Trackr

Trial economics and MVP operating costs. Modelled 2026-08-26.

All figures are **estimates from stated assumptions**, not measurements. Every assumption is labelled so you can challenge the inputs rather than the conclusions.

---

# 1 · INPUT ASSUMPTIONS

| | Value | Source |
|---|---|---|
| Gemini cost per generation | **$0.002** | L058 — ~2,200 in + 600 out tokens at $0.30/$2.50 per MTok |
| Resume parse | **$0.00015** | L061 — 258 tokens/page, native text not billed |
| DB growth per user/month | **~200 KB** | L031 |
| Applications per user/month | **20–50** | PRD p.5 |
| Documents per application | **2** | cover letter + resume |
| Pro price | ₹349 ≈ **$4/month** | PRD p.6 |
| Trial length | **12 days**, no credit card | PRD p.13 |

## How many applications does a motivated applicant file per day?

The PRD's 20–50/month is the anchor. Translated:

| Pattern | Per day | Per 12-day trial |
|---|---|---|
| Casual | 0.7 | ~8 |
| **PRD midpoint (35/month)** | **1.2** | **~14** |
| Heavy | 1.7 | ~20 |
| Burst — a focused Saturday | 5–8 | — |

**Applications cluster.** People apply in bursts at weekends and evenings, not evenly. This matters for rate limits (L093's hourly cap) and for the email send-queue (L036), not for total cost.

Used below: **14 applications per trial user**, PRD midpoint.

---

# 2 · SCENARIO A — 500 users, 12 days, unlimited Pro

"Unlimited" bounded only by L093's fair-use ceiling (20/hr, 50/day, 300/month).

| Case | Generations/user | Total | **Gemini cost** |
|---|---|---|---|
| Realistic — 14 apps × 2 docs | 28 | 14,000 | **$28** |
| Heavy — every app, both docs, some regenerating | 60 | 30,000 | **$60** |
| **Abuse — 20 throwaway accounts at the ceiling** | 300 | 6,000 (those 20 alone) | **$12** |
| **Theoretical worst — all 500 at the ceiling** | 300 | 150,000 | **$300** |

**Realistic cost: $28. Worst case: $300.** The 10× gap between them is the entire problem — you cannot budget for it.

---

# 3 · SCENARIO B — 500 users, trial capped at 60 generations

| Case | Generations/user | Total | **Gemini cost** |
|---|---|---|---|
| Realistic | 28 | 14,000 | **$28** |
| Heavy | 60 | 30,000 | **$60** |
| **Worst possible — every user maxes the cap** | 60 | 30,000 | **$60** |

**Realistic cost: identical. Worst case: $300 → $60, a 5× reduction.**

The cap costs you nothing in the normal case, because 60 is more than double what a realistic trial user consumes. It only bites abusers.

## Why 60

- 14 applications × 2 documents = 28 — a genuine user sits at less than half the cap
- Even a heavy user doing 20 applications with both documents plus regenerations lands near 50
- 60 is **12× the free tier** (5/month), so the trial still feels dramatically more capable
- Worst-case exposure: **$0.12 per user**

## What "limited" should NOT touch

The cap applies to **generation only**. Everything else stays genuinely unlimited during trial:

- Unlimited application tracking
- PDF download (the Pro feature from L062)
- Follow-up sending (L038 Option B)
- All boards, filters, call logs, reminders

The trial must demonstrate the product, not a crippled version of it. Generation is the only line item with marginal cost.

---

# 4 · EVERY OTHER COST LINE

## 4.1 Database storage

500 trial users × 12 days ≈ 0.4 months × 200 KB = **~40 MB**. Trivial.

At 1,000 sustained users over a year: ~3.4 GB (L032). Railway bills storage as part of usage — call it **$1–3/month** at that point.

## 4.2 Document storage (R2)

**$0 during trial.** L062 gates PDF download to Pro, and L028 stores text in Postgres with PDFs rendered client-side. R2 only accrues when a paying user explicitly saves a version.

R2's free tier is 10 GB. At 150 KB per saved PDF, that's ~66,000 saved documents before you pay anything. **Zero egress fees** — the reason R2 was chosen over S3.

## 4.3 Email — ⚠️ the actual constraint

This is where 500 trial users hurts, and it isn't the money.

| Type | Volume over 12 days |
|---|---|
| Verification OTP | 500 (one per user) |
| Password resets | ~25 (5%) |
| Follow-up reminders — fire on day 7, so only applications from trial days 1–5 trigger inside the window | ~2,900 |
| **Total** | **~3,400** |

**~283 emails/day against Brevo's 300/day free tier.** You are at 94% of capacity at 500 trial users.

**And the daily average understates it.** Reminders fire in a morning batch (L036) — the queue must spread them, or a single morning exceeds the daily cap and legitimate verification emails start failing.

**Brevo paid starts around $9/month for 5,000 emails.** Budget it from launch rather than discovering it at 3am.

## 4.4 Compute

Railway Hobby: **$5 minimum, ~$6–12 realistic** (L019). 500 trial users generate roughly 1 write/minute and 5 reads/minute — about 0.03% of a small Postgres instance (L033). **Compute is not a cost driver at this scale.**

## 4.5 Network egress

Text responses, a few KB each. R2 egress is free. **Under $1/month.**

## 4.6 Sessions, cookies, tokens

Database rows measured in bytes. `sessions`, `oauth_states`, `verification_tokens`, `auth_attempts` — a few MB at 500 users, and the expiry sweep keeps them bounded. **Effectively $0.**

## 4.7 Resume parsing

One per user, ever: 500 × $0.00015 = **$0.08.** Rounding error (L061).

---

# 5 · TOTAL — 500 trial users, one month

| Line | Scenario A (unlimited) | **Scenario B (60 cap)** |
|---|---|---|
| Gemini — realistic | $28 | $28 |
| Gemini — worst case | **$300** | **$60** |
| Railway | $10 | $10 |
| Brevo | $9 | $9 |
| R2 | $0 | $0 |
| Domain (annualised) | $1 | $1 |
| **Realistic total** | **~$48** | **~$48** |
| **Worst-case total** | **~$320** | **~$80** |

**Same expected cost. Worst case cut by 4×.**

---

# 6 · CONVERSION MATH

No-credit-card trials convert at roughly **8–15%**; card-required trials at 40–60% — but produce far fewer trials.

At 500 trials and 10% conversion: **50 Pro users × $4 = $200/month revenue** against ~$48 in costs.

**Break-even is around 12 paying users.** That's the number to watch.

⚠️ **Expect the conversion rate to look bad.** 10% next to a card-required 50% reads like failure. It isn't — you're trading conversion rate for volume and usage data, which is the correct trade pre-revenue. Judge absolute paying users, not the percentage.

## The card-for-discount idea

**Recommendation: no, not in MVP.** It pulls F6 into F1's trial flow, still needs PCI-compliant hosted checkout even without charging, and reintroduces exactly the friction the no-card trial exists to remove.

**Better:** offer the discount **at trial end**, to users who actually used the product. Same incentive, no upfront friction, pitched to a warm user rather than a stranger.

---

# 7 · WHAT'S IN THE MOCKUPS BUT NOT THE PRD

| | Cost implication |
|---|---|
| Tone selector (mockup 07) | **Dropped** — L100 |
| Search + Status/Source/Sort filters (mockup 04) | Database queries only. **$0** |
| Board/List toggle (mockup 04) | Frontend only. **$0** |
| Global Documents + Reminders nav | Read queries. **$0** |
| `Regenerate` button (mockup 07) | ⚠️ **Each click costs a full generation.** Must decrement quota and be visibly labelled |

**In the PRD but not yet mocked:** post-call three-question log (p.13), follow-up email draft, upgrade/payment screen, trial countdown.

---

# 8 · WHAT I'D DO

1. **Cap the trial at 60 generations.** Costs nothing in the normal case, cuts worst case 5×.
2. **Require email verification before the first generation** (L040, already decided). Raises the cost of a throwaway account from zero to "own an inbox" — the single most effective anti-abuse measure available.
3. **Budget $9/month for Brevo from launch.** 500 trial users puts you at 94% of the free tier.
4. **Show the trial countdown** — `Pro trial · 8 days left`, not "Free plan".
5. **Track everything in `ai_usage`** (L097) from the first generation. You cannot reconstruct this data later.
6. **Discount at trial end, not card at trial start.**

---

# 9 · WHAT WOULD CHANGE THESE NUMBERS

| | Impact |
|---|---|
| Gemini raises prices | Linear — the dominant variable cost |
| Free tier quota changes again | L066 still unverified; Google cut quotas 50–80% in Dec 2025 |
| Users generate far more than 2 docs/application | Regenerate is the likely driver — watch it in `ai_usage` |
| Signups exceed 500/month | Brevo tier first, then Gemini |
| Trial abuse via throwaway emails | Capped by the 60 limit + verification |

**Re-run this model once `ai_usage` has 30 days of real data.** Everything above is inference from the PRD, not measurement.

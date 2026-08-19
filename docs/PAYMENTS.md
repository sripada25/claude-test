# Payments

## Providers

| Region | Provider | Status |
|---|---|---|
| India | Razorpay | v1, primary |
| International | Stripe | v1, secondary — Indian Stripe accounts are currently invite-only with limited local payment method support; verify current account eligibility before building the Stripe path |

Do not build Stripe first simply because its API is more familiar or
better documented. Razorpay ships first; Stripe is added behind the same
interface once account eligibility is confirmed.

## Pricing (from product spec)

- 12-day free trial — full Pro access, no card required
- Pro: ₹349/month (India) or $9.99/month (international)
- Annual: ₹2,999/year (India) or $79/year (international)
- Free tier after trial: 5 generations/month, unlimited tracking

Pricing is a business decision recorded here for reference, not
something the agent should change without explicit instruction — see
AGENTS.md §2, "never guess product requirements."

## Provider abstraction

```
PaymentProvider
  ├── RazorpayProvider
  └── StripeProvider
```

Application business logic must not depend on Razorpay-specific or
Stripe-specific field names anywhere outside the two provider
implementations. Use the internal model instead:

```
Payment
  id
  userId
  provider
  providerPaymentId
  providerOrderId
  amount
  currency
  status
  createdAt
  updatedAt
```

This is the `payments` table defined in `docs/DATABASE.md`.

## Flow

```
create payment/order
        |
        v
customer checkout
        |
        v
provider callback/webhook
        |
        v
server-side signature verification
        |
        v
server-side payment state transition
```

## Rules — non-negotiable

- **Never mark a payment successful based on frontend behaviour.** A
  redirect to a success page proves nothing about whether money moved.
- The backend independently verifies payment authenticity via the
  provider's signature verification mechanism (Razorpay documents this
  explicitly for payment callbacks/links).
- Never trust, from the client: payment-success page state, payment
  status, amount, currency, or order ownership. The backend determines
  all of these from its own records and the verified webhook, not from
  anything the client sends.
- **Webhooks must be idempotent.** A webhook can be delivered more than
  once — repeated delivery must not create duplicate transactions or
  duplicate entitlements (e.g. granting Pro access twice). Key on
  `provider_payment_id` (see the unique index in `docs/DATABASE.md`) and
  make the handler a no-op on a repeat.
- Use test/sandbox credentials in development and staging. Never use
  production payment credentials for development testing.
- Note (Razorpay-specific, current as of the product spec's research):
  UPI Collect was deprecated effective 28 February 2026 — new
  implementations must use the currently supported UPI flow, not the
  old collect model. Verify this against Razorpay's current
  documentation before building the checkout flow, since payment
  provider APIs change.

## Refunds and cancellation

Not yet defined in the product spec. This is an **OPEN DECISION** —
refund rules, cancellation behaviour (immediate vs. end-of-cycle), and
proration are business decisions that must be confirmed before the
payments milestone (see `docs/DEPLOYMENT.md`'s build order) rather than
assumed by whoever implements the payment flow first.

## Security checklist (payments-specific)

Full list in `docs/SECURITY.md`. Payments-specific items:

- [ ] Server verifies payment status independently of the client
- [ ] Payment signatures / webhooks are cryptographically verified
- [ ] Webhooks are idempotent
- [ ] Client cannot choose or influence the amount charged
- [ ] Refund behaviour is explicitly defined, not assumed

# Team Seats, Credits & Onboarding — Architecture

Status: **Phase 1 landed (schema + seat helpers + credit hook).** Stripe wiring,
UI, and onboarding resequence are pending.

This document is the context for three connected features. It is grounded in the
existing codebase — it extends what is there rather than replacing it.

## What already exists (the foundation)

| Concern | Reality | Files |
|---|---|---|
| Members | `users` table (`accountId`, `email`, `role`, `isActive`, `deletedAt`); roles `owner/admin/manager/staff/technician/agent`. Legacy `inviteTeamMembers()` created **inactive `users` rows** + Supabase magic link, capped at 3, owner-only. | `packages/db/schema.ts`, `app/(admin)/admin/onboarding/actions.ts` |
| Billing | `accounts.plan` (`team`/`enterprise`) + `stripeCustomerId/SubscriptionId`. Two paths: hardcoded Payment Links (onboarding) and `createSubscriptionCheckout` (Price IDs, quantity-based). Webhook syncs. | `lib/stripe/*`, `lib/onboarding/pricing-plans.ts`, `app/api/webhooks/stripe/route.ts` |
| Credits | **Account-level shared pool** (`sdrCreditAccounts` keyed by `accountId`, monthly UTC reset, `sdrCreditLedger` audit). Allowance from `billingTier` only (free 100 / standard 500 / premium ∞). Spent by **agent** actions (lead pull 0.1, send 0.3) — never by humans directly. | `lib/sdr/credits.ts`, `lib/sdr/credit-types.ts` |
| Onboarding | business → AI overview → lead preview → revenue goal → subscription. `Step4Team` is fully built but **not wired in**. | `app/(admin)/admin/onboarding/*` |

## Feature 1 — Team seats & invites

### Data model
New `account_invites` table (migration `add_account_invites_table`, applied to
Vantera-dev `kchaqjyvubbrrjpisxpy`): `id, accountId, email, role, status
(pending|accepted|revoked|expired), tokenHash, invitedBy, expiresAt, acceptedAt`.
A unique partial index enforces **one pending invite per email per account**.

A **seat** is occupied by an active `users` row **or** a pending invite. Pending
is kept separate from active so invites can be resent/revoked and counts stay
honest. On accept: create the active `users` row, mark the invite `accepted`.

### Economics (single source of truth: `lib/team/seats.ts`)
- **Included seats:** Team = 1 (owner), Enterprise = 5.
- **Billable seats** = `max(0, activeMembers + pendingInvites − includedSeats)`.
- **Price** = `$25/seat/mo` (`SEAT_PRICE_USD`).
- `getSeatUsage(accountId, plan)` returns the full breakdown; `getBillableSeatCount`
  is the billing/credit hook (fails closed to 0 pre-migration).

### Stripe (pending)
Move paid-plan onboarding off static Payment Links onto `createSubscriptionCheckout`
so the subscription carries **two line items**: base plan (qty 1) + a recurring
**Seat** price (`STRIPE_PRICE_SEAT_MONTHLY`, qty = billable seats). Invite / accept /
remove → update the seat item quantity (Stripe prorates); the webhook reconciles
`accounts` + seat state. Requires creating the Seat price in Stripe and adding the
env var.

### UI (pending)
- Settings → **Team**: member list, pending invites, role edit, remove, "Invite"
  modal previewing the seat delta (`+1 seat · +$25/mo`). Lift the legacy 3-member cap.
- Onboarding: re-wire `Step4Team` (refreshed).

## Feature 2 — Credit system: shared pool + per-seat top-up

**Decision:** one shared account-wide pool; each paid seat **adds** credits to that
shared pool (not per-seat buckets).

**Why:** credits are spent by the autonomous SDR agents on the whole account's
behalf, not by individual humans. Per-seat buckets would cause starvation,
hoarding, and a confusing second number, and would punish collaboration (bad for
retention). A shared pool keeps one number everyone watches; making seats lift it
turns "add a teammate" into "raise our capacity" — accumulated value, a real
reason to grow seats.

### Mechanism (landed)
`lib/sdr/credit-types.ts`:
- `SEAT_CREDIT_BONUS = 250`
- `monthlyAllowance(tier, billableSeats)` = `base(tier) + 250 × billableSeats`
  (returns `null`/unlimited for premium).

`lib/sdr/credits.ts` — `getSdrCreditStatus` now computes the limit via
`allowanceForAccount(accountId, tier)`, which reads the plan + billable seats and
applies the top-up. Premium short-circuits (already unlimited → no seat read).
Net effect by tier:
- **free** → 100 (free plans bill no seats → no bonus)
- **standard (Team)** → 500 + 250 × billable seats
- **premium (Enterprise)** → unlimited (seats = access only)

The existing `SdrCreditStrip` renders the pool and will reflect the boosted limit
with no change.

## Feature 3 — Onboarding resequence (keep what works)

Principle (UX architecture): value before commitment, defer the deferrable, one
decision per step, end on a win (Peak–End). Steps 1–3 already deliver the "aha"
(real ICP leads), so they stay.

1. **Business details** — required; seeds everything. *(keep)*
2. **AI overview** — the analysis moment. *(keep)*
3. **Lead preview** — first value (real leads); mark it as the win. *(keep)*
4. **Plan + seats** — value→commit at peak motivation; seats introduced here.
5. **Invite team** — re-wire `Step4Team`, now in-context of chosen seats; skippable.
6. **Revenue goal** — moved to the close → lands on the dashboard MRR panel filling.

## Build phases

- **Phase 1 (done):** `account_invites` migration; `lib/team/seats.ts`;
  `SEAT_CREDIT_BONUS` + `monthlyAllowance`; credit hook reads seat top-up. Type-check green.
- **Phase 2:** Stripe Seat price + `STRIPE_PRICE_SEAT_MONTHLY`; seat-quantity sync on
  invite/accept/remove; webhook reconciliation; move paid onboarding to Checkout Sessions.
- **Phase 3:** Settings → Team UI; invite/accept/revoke flow + accept route; seat-cost preview.
- **Phase 4:** Onboarding resequence + re-wire `Step4Team`.

## Open setup items (need you / Stripe dashboard)
- Create a recurring **$25/mo Seat price** in Stripe; set `STRIPE_PRICE_SEAT_MONTHLY`.
- Confirm proration behavior on seat add/remove (default: Stripe automatic proration).

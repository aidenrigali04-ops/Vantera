# Billing & team seats (Phase 7)

**Date:** 2026-06-13
**Status:** Approved (design)
**Roadmap:** Phase 7 — Billing & team seats. Key rules: 02 (Stripe, RLS), 04 (per-LinkedIn-account pricing), 09 (billing deep-link-only for copilot), 11 (RLS/tenancy on new surfaces).

## Goal

Customers can pay, and plans gate usage. A tiered subscription (with per-unit
add-ons) unlocks the product; over-limit or lapsed accounts can't create new
resources and outreach pauses, but existing data is never destroyed.

## Existing groundwork (do not rebuild)

- `accounts.stripeCustomerId` + `accounts.stripeSubscriptionId` exist (`0001`),
  server-managed via column grants (client cannot write).
- `account_members` (roles `owner`/`admin`/`member`) and `account_invites`
  (status lifecycle `pending`/`accepted`/`revoked`/`expired`, token, expiry)
  shipped as schema in Phase 2. Settings → Team currently reads
  "invites coming soon" — **the seat-management UI is the gap.**
- `accounts.outreachPaused` + the Phase 5 scheduler account-pause check already
  exist — billing reuses them for the lapse→pause behavior.
- `webhook_events` idempotency table exists (`source` enum `email`/`linkedin`),
  purged after 30 days — Stripe reuses it.
- `packages/transactional-email` (Resend) exists for invite emails.

## Scope decisions (locked during brainstorming)

1. **Pricing: tiered plans + per-LinkedIn-account add-on.** A few named tiers set
   feature limits + included seats; LinkedIn accounts are billed per-unit on top
   (Stripe quantity line). Rule 04's metered unit is the LinkedIn account.
2. **Seats: included base + purchasable add-on.** Each tier includes a base seat
   count; extra seats are a second per-unit quantity line. Seats = people who can
   log in; distinct from LinkedIn accounts (outreach capacity).
3. **Gate behavior: block-new, preserve-existing.** Over-limit or lapsed
   (no plan / `past_due` / `canceled`) = cannot create or connect new resources
   (campaigns, mailboxes, seats, LinkedIn accounts) and outreach pauses. Existing
   data is never deleted; reactivating restores access.
4. **Stripe-hosted Checkout + Billing Portal** (deep-link), no in-app card form.
5. **Plan limits live in a `plans.ts` code config**, not a DB table. One
   subscription per account.

### Out of scope (deliberate)

- Usage-based metered billing beyond the two quantity lines (seats, LinkedIn
  accounts). No per-send or per-lead metering.
- In-app payment-method capture / PCI surface — Stripe-hosted only.
- Proration UI / mid-cycle math — Stripe handles proration; we surface the
  result, not recompute it.
- Annual vs. monthly toggle is a Stripe price-config detail, not new app logic.

## Architecture (approach A — webhook-synced snapshot + pure gate)

```
Stripe (system of record)
   │  checkout.session.completed / customer.subscription.* / invoice.*
   ▼
app/api/billing/webhook/route.ts   (thin: verify signature, idempotency via webhook_events)
   ▼
packages/billing  handleWebhookEvent()  → writes entitlement snapshot onto accounts
   │
   ▼
accounts snapshot: plan, subscriptionStatus, seatsPurchased,
                   linkedinAccountsPurchased, currentPeriodEnd
   │
   ▼
packages/billing  resolveEntitlements(snapshot) → Limits   (pure)
   │
   ▼
requireEntitlement(account, resource, current)  ← called in create-path server actions
   (agent/campaign create, mailbox provision, LinkedIn connect, member invite)
```

Reads are cheap (no Stripe call per request); gates are pure, testable
functions; the plan-config module is the single source of truth for limits.
Stripe sits behind a `BillingProvider` interface so checkout/portal/webhook
logic tests against an in-memory fake (same pattern as `email-infra` /
`linkedin-infra`).

## Components

### 1. `packages/billing` (new; framework rule 13)

- `types.ts` — `BillingProvider` interface
  (`createCheckoutSession`, `createPortalSession`, `verifyAndParseWebhook`,
  `fetchSubscription`) + DTOs (`CheckoutRequest`, `PortalRequest`,
  `ParsedWebhookEvent`, `EntitlementSnapshot`, `Limits`).
- `plans.ts` — **source of truth**: each tier (`starter` / `growth` / `scale`)
  → `{ includedSeats, maxMailboxes, maxCampaigns, features, stripePriceId }`,
  plus the two add-on price IDs (extra seat, LinkedIn account). Price IDs come
  from env (`STRIPE_PRICE_*`); tier identifiers are internal and renameable.
- `entitlements.ts` — pure `resolveEntitlements(snapshot) → Limits` and
  `checkLimit(resource, current, limits) → { allowed, reason? }`.
- `in-memory.ts` + `in-memory.test.ts` — fake provider for tests.
- `stripe.ts` — the only module importing the Stripe SDK; implements
  `BillingProvider` and webhook parsing/verification.
- Purity: no drizzle/DB/Trigger imports — entitlement logic is pure; the web
  layer persists the snapshot.

### 2. Data model (migration `0013`; RLS + grants in the same migration)

Extend `accounts` (server-managed; column grants block client writes, mirroring
the `0001` Stripe-ref pattern):
- `plan` text enum `none`/`starter`/`growth`/`scale`, default `none`.
- `subscriptionStatus` text enum `none`/`trialing`/`active`/`past_due`/`canceled`,
  default `none`.
- `seatsPurchased` int default 0 (extra seats beyond the tier base).
- `linkedinAccountsPurchased` int default 0.
- `currentPeriodEnd` timestamptz nullable.

Extend `webhook_events.source` enum to add `"stripe"` — reuses the existing
idempotency table (`provider_event_id` = Stripe event id). No new table.

No new tenant table: the seat UI operates on existing `account_members` /
`account_invites` (RLS already in place). Guardrail test: client cannot write the
new billing columns.

### 3. Web (`apps/web`)

- **`settings/billing/`** — current plan + usage meters (seats used/included,
  LinkedIn accounts, mailboxes, campaigns vs. limits); "Upgrade" → Stripe
  Checkout; "Manage" → Stripe Billing Portal (both hosted, via server actions);
  `past_due` dunning banner.
- **`settings/team/`** — seat-management UI (replaces "coming soon"): member list
  + roles; invite by email + role (writes `account_invites`, sends via
  `packages/transactional-email`); revoke invite; change role; remove member.
  Accept-invite route `app/invite/[token]/` binds the invited email to the
  joining user and inserts an `account_members` row. Owner/admin permission
  checks in actions. Invite blocked at seat cap with an upgrade CTA.
- **`app/api/billing/webhook/route.ts`** — thin route: Stripe signature
  verification, idempotency insert into `webhook_events`, delegate to
  `packages/billing` handler that writes the snapshot. Handled events:
  `checkout.session.completed`, `customer.subscription.created/updated/deleted`,
  `invoice.payment_failed`, `invoice.paid`.
- **`settings/billing/actions.ts` + `settings/team/actions.ts` + `validation.ts`**
  — pure validation fns with colocated tests; `accountId` always from the
  session, never params; checkout/portal actions create sessions via the
  provider and redirect.
- **Plan gates** — `requireEntitlement(account, resource, current)` added to the
  create-paths: agent/campaign creation, mailbox provisioning, LinkedIn connect,
  member invite. Over-limit/lapsed → friendly error + upgrade CTA.
- **Lapse → pause** — on `past_due`/`canceled` the webhook sets
  `accounts.outreachPaused = true` (scheduler already honors it); on reactivation
  (`active`) it clears the billing-derived pause.

### 4. Copilot (rule 09 — same PR)

- Billing is **deep-link-only**: a read-tier `billing_status` tool (plan, status,
  usage vs. limits over the account's own data, typed DTO) + navigate to
  `/settings/billing`. No mutate tool ever touches Stripe.
- Help articles `billing.md` + `team-seats.md` (title/surface/routes frontmatter).

## Error handling

- **Webhook signature invalid** → 401, nothing written.
- **Duplicate event** (idempotency hit) → 200, no-op.
- **Out-of-order events** → trust the snapshot from
  `customer.subscription.*` payloads (status + items reflect current truth);
  the resolver is idempotent.
- **Over-limit action** → blocked before any write, returns a structured
  reason + upgrade CTA; never a 500.
- **Checkout/portal session creation failure** → surfaced inline; no partial
  state (no DB write until the webhook confirms).

## Testing (TDD; framework rule 13 guardrails)

- `entitlements.ts`: `resolveEntitlements` per tier + add-ons; `checkLimit`
  over/under/at-limit for every gated resource.
- Webhook handler: signature reject, idempotent replay, each event type →
  correct snapshot, lapse→pause and reactivation→unpause, against the fake.
- Seat flow: invite/accept/revoke/role-change validation + owner/admin
  permission tests; seat-cap gate test.
- Gate helpers: blocked-at-limit per create-path.
- Migration: RLS + column-grant guardrail proving the client can't write the new
  billing columns (rule 02).

## Definition of done (rule 12)

1. Full CI gate green (`pnpm lint && type-check && test && build`).
2. Help articles `billing.md` + `team-seats.md` shipped; `billing_status` copilot
   tool registered (rule 09).
3. RLS + grant guardrail test for the new billing columns; `webhook_events`
   `stripe` source covered.
4. Whitelabel: Stripe is a user-facing billing surface (allowed); no
   outreach-vendor names (Smartlead/Unipile/Explorium) leak.
5. Roadmap Phase 7 checkbox flipped.

## Build order

1. `packages/billing`: `types.ts` → `plans.ts` → `entitlements.ts` →
   `in-memory.ts` → `stripe.ts` (TDD throughout).
2. Migration `0013`: account billing columns + `webhook_events.stripe` source +
   grants/RLS test (vantera-db-migrations checklist, rls-auditor pass).
3. Webhook route + entitlement-sync handler.
4. `settings/billing/` page + Checkout/Portal server actions.
5. Plan gates (`requireEntitlement`) on the four create-paths + lapse→pause wire.
6. `settings/team/` seat UI + invite/accept/revoke + invite email.
7. Copilot `billing_status` tool + `billing.md` / `team-seats.md`;
   whitelabel-auditor pass.
8. Roadmap Phase 7 checkbox.

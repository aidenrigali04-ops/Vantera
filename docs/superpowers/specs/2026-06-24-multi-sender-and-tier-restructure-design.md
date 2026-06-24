# Multi-Sender Distribution + Tier Restructure — Design

**Date:** 2026-06-24 · **Phase:** 14 · **Branch:** `phase-14-multi-sender`
**Rules:** 02 (tenant/RLS), 04 (LinkedIn safety), 06 (gate), 11 (suppression), 13 (agent framework), 12 (DoD)

## Problem

The billing layer already entitles multiple LinkedIn sender accounts per tenant
(`includedLinkedinAccounts` 1/3/10 + per-account add-on + `maxLinkedinAccounts`
enforcement), and the schema already holds many `linkedin_accounts` per tenant with
`outreach_sends.linkedin_account_id` recording which one sent. **But the runtime never
uses more than one.** Every send resolves a single identity
(`getActiveLinkedInIdentity(tenant)` in `outreach-send.ts`), and `send-dispatch.ts` caps
volume **per tenant**, not per sender account. So a Scale customer with 10 connected
accounts still sends from one — capacity never scales, and the multi-sender safety pattern
(spread volume so no single account trips LinkedIn's limits) isn't realized.

Separately, pricing/positioning still reflects the pre-rescope product. We restructure the
tiers so **sender capacity is the headline differentiator**, with a generous middle tier,
and the Intent Agent available from the middle tier up.

## Part A — Multi-sender runtime

### Hard constraint (drives the whole design)
An invite and its follow-up message **must** come from the **same** account — you can only
message a connection from the account that connected to them. Therefore sender assignment is
**sticky per lead** for the lead's entire outreach lifecycle.

### A1. Sticky assignment storage
- New column `leads.linkedin_account_id uuid references linkedin_accounts(id)` — **nullable**
  (a lead is unassigned until its first send), indexed.
- RLS already governs `leads`; the new column needs no new policy. Guardrail test:
  `leads` already in the RLS assertion list — no new table, so the existing guard covers it.
  Add a migration-level note; extend `schema.test.ts` only if a new table were added (none here).
- Set on the lead when its **first** send (the invite) is dispatched. Every later send for
  that lead reads the same `linkedin_account_id`.

### A2. Assignment strategy — capacity-weighted least-loaded
When a lead needs a sender (first invite), pick among the tenant's `status='active'` accounts:
1. Exclude paused/restricted/disconnected accounts.
2. Choose the account with the **most remaining invite budget today**
   (`dailyAllowance(senderAgeDays) − sentTodayBySender`, and under the 7-day weekly ceiling).
3. Tie-break: least-recently-assigned (round-robin within equal budget) for even spread.
If no healthy account has budget, the lead is parked (skipped) this cycle — same as today.

### A3. Per-sender caps in the dispatcher
`send-dispatch.ts` currently groups by tenant `accountId` and counts
`countLinkedInSentToday(accountId, …)` / `countLinkedInInvitesLast7Days(accountId, …)`.
Change so caps are computed **per `linkedin_account_id`**:
- For each tenant, for each healthy sender account: `inviteBudget = min(dailyAllowance(thatSenderAge)
  − sentTodayByThatSender, weeklyCeiling − last7dByThatSender)`; `messageBudget` likewise.
- Assign each pending invite to a sender via A2, decrementing that sender's budget.
- Messages (post-connection) are **locked** to the lead's already-assigned sender — they draw
  from that sender's message budget only.
- Per-account warmup ramp keys off **each sender's own** `connectedAt` (the existing
  `getLinkedInAccountAgeDays` becomes per-sender-account, not tenant-oldest).

Net: tenant capacity = **sum** of per-sender capacities; every account independently obeys
20/day · 100/week · its own ramp. No safety threshold is loosened (rule 04/11).

### A4. Send path
`outreach-send.ts` replaces `getActiveLinkedInIdentity(tenant)` with "resolve the lead's
assigned sender account," health-checking **that** account. If the lead has no assignment yet
(first invite), it assigns via A2 and persists before sending.

### A5. Reassignment edge cases
- Lead at **invite** stage whose assigned account goes unhealthy → may be reassigned to
  another healthy account (no connection exists yet).
- Lead at **message** stage (already connected via account A) → **locked** to A; if A is
  unhealthy the message waits (or cancels on invite-expiry, existing logic). Never re-sent
  from a different account.

### A6. Suppression unchanged
Suppression is still checked at the scheduler boundary and again at send (rules 11) — the
multi-sender change only affects *which* account sends, never *whether* a suppressed lead is
contacted. Existing suppression guard test stays green; add a test that a suppressed lead is
skipped regardless of available senders.

## Part B — Tier restructure + rebuilt cards

Internal enum `starter/growth/scale` and Stripe price IDs are unchanged; **inclusions** and
**positioning** change. Sender count is the headline line on every card.

| | Starter $45 | **Growth $79 · Most popular** | Scale $349 |
|---|---|---|---|
| LinkedIn senders (headline) | 1 | **5** | 15 |
| Intent Agent | — | **✓** | ✓ |
| Team seats | 1 | 3 | 10 |
| Campaigns | 2 | 10 | Unlimited |
| Extra senders | add-on | add-on | add-on |

- `plans.ts`: `includedLinkedinAccounts` → **1 / 5 / 15**; `features.intent` → **true for growth
  + scale** (was scale-only); `maxCampaigns` → **2 / 10 / 999** (Unlimited shown as a large cap).
- `includedSeats` stays 1 / 3 / 10.
- Prices ($45/$79/$349) are **Stripe-side**; the owner creates/updates the Stripe prices + env
  (`STRIPE_PRICE_*` / `_ANNUAL`). Code change is inclusions + card copy only.
- Rebuild both card surfaces (`apps/web/src/app/pricing/marketing-pricing.tsx`,
  `apps/web/src/app/(app)/settings/billing/pricing-plans.tsx`) + `packages/billing/src/display.ts`
  to lead with senders, mark Growth "Most popular," and use the "LinkedIn automation power
  system" voice. No vendor names (white-label).
- Knowledge-sync: `packages/help-content/content/billing.md` reconciled to the new tiers.

## Testing

- **Unit (pure):** assignment picks the highest-budget healthy sender; even spread on ties;
  parks when no budget; per-sender caps hold independently; messages stay locked to the
  assigned sender; suppressed lead skipped regardless of senders.
- **Entitlements:** `resolveEntitlements` returns senders 1/5/15 and `intent` true for
  growth/scale; `display.ts` test updated for new headline + tiers.
- **Migration:** `leads.linkedin_account_id` present + indexed; existing RLS guard green.
- Full gate: `pnpm lint && type-check && test && build`; `rls-auditor` on the migration diff;
  `whitelabel-auditor` on the card diff.

## Out of scope (YAGNI)

- Cross-account inbox/unified reply view (replies already route through the shared handler).
- Automatic account-health *recovery* beyond status checks (manual reconnect stays the path).
- Acceptance-rate auto-throttle (separate, higher-priority safety build — tracked, not here).
- Any destructive migration or Stripe automation (owner applies price changes).

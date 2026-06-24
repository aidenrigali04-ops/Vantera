# Multi-Sender Distribution + Tier Restructure Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make outreach send from *all* of a tenant's connected LinkedIn accounts (sticky per lead, per-sender safety caps), and restructure the pricing tiers so sender capacity is the headline differentiator.

**Architecture:** A pure `assignSender` selector (capacity-weighted least-loaded) picks one healthy sender per lead at first-invite; the choice persists on `leads.linkedin_account_id` and every later send reuses it. `send-dispatch` computes safety budgets per *sender account* instead of per tenant, so total capacity = sum across senders with each account independently obeying 20/day · 100/week · its own ramp. `outreach-send` resolves the lead's assigned sender. Billing `plans.ts`/`display.ts` + both card surfaces restructure to senders-as-headline (1/5/15), Intent from Growth up.

**Tech Stack:** TypeScript (strict), Drizzle + Supabase Postgres (RLS), Trigger.dev v4, Next.js App Router, Vitest, Stripe.

## Global Constraints

- Tenant `accountId` only from validated session — never URL/query/body (rule 02).
- LinkedIn safety limits non-configurable below thresholds; live in the scheduler, never the provider (rule 04): 20 invites/day steady, 100 invites/week rolling ceiling, ramp 5/10/15→20, ±30% jitter pacing.
- Suppression checked at scheduler boundary AND at send; a suppressed lead is never sent to (rule 11) — prove with a test.
- No vendor names (Unipile/Explorium/Stripe) in any user-facing surface, DTO, or help content (white-label).
- New table → RLS in same migration + guardrail test. New column on existing RLS table → no new policy; migrations append-only (`NNNN_<slug>.sql`).
- AI only via `@vantera/ai` `getModel()` (n/a here — no new AI calls).
- Colocated `*.test.ts`; pure pipeline logic in `packages/jobs/src/pipeline/`, drizzle only in `pg-store.ts`, thin trigger wrappers import core.
- Internal plan enum stays `starter/growth/scale`; Stripe price IDs unchanged (owner applies actual price numbers $45/$79/$349 Stripe-side).

---

### Task 1: Migration — sticky sender assignment column

**Files:**
- Create: `packages/db/migrations/0034_lead_sender_assignment.sql`
- Modify: `packages/db/src/schema.ts` (leads table: add `linkedinAccountId`)

**Interfaces:**
- Produces: `leads.linkedin_account_id uuid null references linkedin_accounts(id)`, indexed; Drizzle field `leads.linkedinAccountId`.

- [ ] **Step 1:** Add migration SQL: `alter table public.leads add column linkedin_account_id uuid references public.linkedin_accounts(id) on delete set null;` + `create index leads_linkedin_account_idx on public.leads(linkedin_account_id);` with a comment: sticky sender per lead; nullable until first invite; RLS already on `leads` (rule 02), no new policy.
- [ ] **Step 2:** Mirror in `schema.ts` leads table: `linkedinAccountId: uuid("linkedin_account_id").references(() => linkedinAccounts.id, { onDelete: "set null" })` + add `index("leads_linkedin_account_idx").on(t.linkedinAccountId)`.
- [ ] **Step 3:** Run `pnpm --filter @vantera/db test` — existing `schema.test.ts` RLS guard stays green (leads already listed; no new table).
- [ ] **Step 4:** `rls-auditor` subagent on `git diff -- packages/db`; resolve findings.
- [ ] **Step 5:** Commit `feat(db): add leads.linkedin_account_id sticky sender column (0034)`.

---

### Task 2: Pure sender-assignment selector

**Files:**
- Create: `packages/jobs/src/pipeline/sender-assignment.ts`
- Test: `packages/jobs/src/pipeline/sender-assignment.test.ts`

**Interfaces:**
- Consumes: `dailyAllowance`, `LINKEDIN_WEEKLY_INVITE_CEILING` from `./safety-limits`.
- Produces:
  ```ts
  export interface SenderCandidate {
    linkedinAccountId: string;
    ageDays: number;        // that account's own connection age
    sentToday: number;      // invites sent today by this account
    last7d: number;         // invites in rolling 7 days by this account
    lastAssignedAt: number; // epoch ms of most recent assignment (0 if never)
    healthy: boolean;       // status === 'active'
  }
  export function inviteBudget(c: SenderCandidate): number; // max(0, min(daily−sentToday, weekly−last7d))
  export function assignSender(candidates: SenderCandidate[]): string | null; // picks id, or null if none has budget
  ```

- [ ] **Step 1:** Write failing tests: (a) picks the healthy candidate with the most `inviteBudget`; (b) excludes `healthy:false`; (c) returns `null` when every candidate's budget is 0; (d) ties on budget broken by smallest `lastAssignedAt` (least-recently-assigned); (e) `inviteBudget` clamps at the weekly ceiling even when daily budget remains.
- [ ] **Step 2:** Run `pnpm --filter @vantera/jobs test sender-assignment` — FAIL (module missing).
- [ ] **Step 3:** Implement `inviteBudget` = `Math.max(0, Math.min(dailyAllowance("linkedin", c.ageDays) - c.sentToday, LINKEDIN_WEEKLY_INVITE_CEILING - c.last7d))`; `assignSender` = filter healthy + budget>0, sort by budget desc then `lastAssignedAt` asc, return first id or null.
- [ ] **Step 4:** Run tests — PASS.
- [ ] **Step 5:** Commit `feat(jobs): capacity-weighted least-loaded sender selector`.

---

### Task 3: Per-sender caps + assignment in send-dispatch

**Files:**
- Modify: `packages/jobs/src/pipeline/send-dispatch.ts`
- Modify: `packages/jobs/src/pipeline/types.ts` (`SendDispatchDeps.store` methods)
- Test: `packages/jobs/src/pipeline/send-dispatch.test.ts`

**Interfaces:**
- Consumes: `assignSender`, `SenderCandidate` (Task 2); `leads.linkedinAccountId` (Task 1).
- Produces (new store methods, fakes in `in-memory`/test store + real in pg-store Task 5):
  ```ts
  listSenderCandidates(tenantAccountId: string, now: Date): Promise<SenderCandidate[]>;
  assignLeadSender(leadId: string, linkedinAccountId: string): Promise<void>;
  ```
  `DispatchableSend` gains `leadAssignedSenderId: string | null` and `leadId: string`.

- [ ] **Step 1:** Write failing tests: (a) two healthy senders each get ~half of N pending invites (spread); (b) a sender at its daily cap receives no more, the other absorbs within its own cap; (c) total scheduled across senders = sum of per-sender budgets, not a single tenant cap; (d) a lead at message stage with `leadAssignedSenderId=A` draws only from A's message budget; (e) suppressed/paused unchanged (kill-switch halts, paused account skipped).
- [ ] **Step 2:** Run dispatch tests — FAIL.
- [ ] **Step 3:** Refactor `runSendDispatch`: within each tenant group, load `listSenderCandidates`; for invite rows without `leadAssignedSenderId`, call `assignSender`, on hit `assignLeadSender(leadId, id)` + decrement that candidate's in-memory `sentToday`/bump `lastAssignedAt`; schedule. For message rows, draw from the assigned sender's message budget. Keep kill-switch, pause, trial cap, jitter pacing unchanged.
- [ ] **Step 4:** Run tests — PASS.
- [ ] **Step 5:** Commit `feat(jobs): per-sender safety caps + lead→sender assignment in dispatch`.

---

### Task 4: outreach-send resolves the lead's assigned sender

**Files:**
- Modify: `packages/jobs/src/pipeline/outreach-send.ts`
- Modify: `packages/jobs/src/pipeline/types.ts` (store: `getLeadAssignedIdentity`)
- Test: `packages/jobs/src/pipeline/outreach-send.test.ts`

**Interfaces:**
- Consumes: `leads.linkedinAccountId` (Task 1).
- Produces store method:
  ```ts
  getLeadAssignedIdentity(leadId: string): Promise<{ id: string; providerRef: string; status: string } | null>;
  ```

- [ ] **Step 1:** Write failing tests: (a) send uses the lead's assigned sender's `providerRef`, not the tenant's first active identity; (b) if the assigned sender is unhealthy at message stage the send is skipped (not re-sent from another); (c) an unassigned lead at invite stage assigns + persists before sending.
- [ ] **Step 2:** Run outreach-send tests — FAIL.
- [ ] **Step 3:** Replace `getActiveLinkedInIdentity(ctx.accountId)` with `getLeadAssignedIdentity(ctx.leadId)`; on null at invite stage, assign via the same selector path + persist; health-check that specific account; suppression check unchanged.
- [ ] **Step 4:** Run tests — PASS.
- [ ] **Step 5:** Commit `feat(jobs): send from the lead's assigned LinkedIn sender`.

---

### Task 5: Real store wiring (pg-store)

**Files:**
- Modify: `packages/jobs/src/pipeline/pg-store.ts`
- Test: extend existing pg-store test coverage if present; otherwise rely on Tasks 2–4 pure tests + typecheck.

**Interfaces:**
- Implements `listSenderCandidates`, `assignLeadSender`, `getLeadAssignedIdentity`; updates `getDispatchableSends` to include `leadId` + `leadAssignedSenderId`.

- [ ] **Step 1:** Implement `listSenderCandidates`: select tenant's `linkedin_accounts` where `status='active'`, left-join counts (today invites, last-7d invites per account from `outreach_sends`), compute `ageDays` from each account's `connectedAt`, `lastAssignedAt` from max `leads.updated_at` where assigned (or 0).
- [ ] **Step 2:** Implement `assignLeadSender` (update `leads.linkedin_account_id`) and `getLeadAssignedIdentity` (join `leads`→`linkedin_accounts`).
- [ ] **Step 3:** Update `getDispatchableSends` select to carry `leadId` and the lead's `linkedinAccountId` as `leadAssignedSenderId`.
- [ ] **Step 4:** `pnpm --filter @vantera/jobs type-check && test` — PASS.
- [ ] **Step 5:** Commit `feat(jobs): pg-store multi-sender queries`.

---

### Task 6: Tier restructure in billing core

**Files:**
- Modify: `packages/billing/src/plans.ts`
- Modify: `packages/billing/src/display.ts`
- Test: `packages/billing/src/plans.test.ts`, `packages/billing/src/entitlements.test.ts`, `packages/billing/src/display.test.ts`

**Interfaces:**
- Produces: `PLANS` with `includedLinkedinAccounts` 1/5/15, `features.intent` true for growth+scale, `maxCampaigns` 2/10/999.

- [ ] **Step 1:** Update tests: `resolveEntitlements` → growth `maxLinkedinAccounts` 5 + `intent:true`; scale 15; starter 1 + `intent:false`; `maxCampaigns` 2/10/999. Update `display.test.ts` expectations for new headline/tier copy.
- [ ] **Step 2:** Run billing tests — FAIL.
- [ ] **Step 3:** Edit `plans.ts`: starter `includedLinkedinAccounts:1, maxCampaigns:2, features:{intent:false}`; growth `5, 10, {intent:true}`; scale `15, 999, {intent:true}`. Update `display.ts` plan cards data (headline "N LinkedIn senders", Growth `mostPopular:true`, Intent badge growth+, power-system voice copy).
- [ ] **Step 4:** Run tests — PASS.
- [ ] **Step 5:** Commit `feat(billing): restructure tiers — senders 1/5/15, Intent from Growth`.

---

### Task 7: Rebuild pricing card surfaces

**Files:**
- Modify: `apps/web/src/app/pricing/marketing-pricing.tsx`
- Modify: `apps/web/src/app/(app)/settings/billing/pricing-plans.tsx`

**Interfaces:**
- Consumes: `display.ts` card data (Task 6).

- [ ] **Step 1:** Rebuild marketing cards: senders as the headline metric, Growth flagged "Most popular," Intent badge on Growth+Scale, "Unlimited" campaigns on Scale, per-surface dark theme + existing primitives (rule 07). No vendor names.
- [ ] **Step 2:** Mirror in the in-app billing `pricing-plans.tsx` (same data source, app-density styling).
- [ ] **Step 3:** `pnpm --filter web lint && type-check` — PASS; visual spot check copy vs. the tier table.
- [ ] **Step 4:** `whitelabel-auditor` subagent on the card diff.
- [ ] **Step 5:** Commit `feat(web): rebuild pricing cards — senders headline + new tiers`.

---

### Task 8: Knowledge-sync + ship gate

**Files:**
- Modify: `packages/help-content/content/billing.md`
- Modify: `docs/roadmap.md` (Phase 14 checkbox)

- [ ] **Step 1:** Reconcile `billing.md` to the new tiers (senders 1/5/15, Intent from Growth, prices $45/$79/$349) — no vendor names; `articles.test.ts` stays green.
- [ ] **Step 2:** Add Phase 14 entry to `docs/roadmap.md`, checked.
- [ ] **Step 3:** Full gate: `pnpm lint && pnpm type-check && pnpm test && pnpm build` — all green.
- [ ] **Step 4:** Commit `docs: knowledge-sync billing + roadmap Phase 14`.

---

## Notes for execution

- **Prices are Stripe-side.** After merge the owner creates/updates Stripe prices for $45/$79/$349 (monthly + annual) and the `STRIPE_PRICE_*` env in Vercel/Trigger. Code carries inclusions + copy only; no price numbers are hard-coded.
- **Account age = connection age** is a known limitation (warmup ramp keys off `connectedAt`); per-sender age uses each account's own `connectedAt`, which is correct for distribution. True account-age tracking + acceptance-rate throttle are separate, tracked builds.
- Suppression and kill-switch paths are untouched in behavior — only *which* sender is chosen changes.

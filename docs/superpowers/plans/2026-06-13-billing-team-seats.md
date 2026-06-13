# Billing & Team Seats Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Customers can subscribe to a tiered plan with per-unit add-ons (LinkedIn accounts, extra seats), plans gate resource creation, lapsed accounts pause outreach without losing data, and a team can manage seats.

**Architecture:** Stripe (system of record) → signed webhook → a denormalized entitlement snapshot on `accounts`. A pure `packages/billing` resolver maps the snapshot to concrete limits via a code-config; a single `requireEntitlement` helper guards each create-path. Stripe sits behind a `BillingProvider` interface with an in-memory fake for tests. Checkout and the billing portal are Stripe-hosted (deep-link). Seat management runs on the existing `account_members` / `account_invites` schema.

**Tech Stack:** TypeScript (strict), Next.js App Router (server actions + route handlers), Supabase (Postgres + RLS, `@supabase/ssr`), Drizzle (schema), Stripe SDK, Resend (`@vantera/transactional-email`), Vitest, Trigger.dev (unaffected; the scheduler already honors `accounts.outreach_paused`).

**Conventions to follow (verified in-repo):**
- Infra packages: `@vantera/<name>`, `src/{types,index,in-memory,in-memory.test,<vendor>,<vendor>.test}.ts`, public surface re-exported from `index.ts` (see `packages/email-infra`).
- Server actions: `createClient()` from `@/lib/supabase/server`; account resolved via RLS-scoped select (`from("accounts").select("id").limit(1).maybeSingle()`), **never** from form/params (rule 02); `revalidatePath` after writes.
- Validation: pure functions returning `Valid<T> | Invalid` from `@/lib/validation`, colocated `*.test.ts`.
- Webhooks: `createServiceClient()` from `@/lib/supabase/service`; insert into `webhook_events` (unique `(source, provider_event_id)`); PG error `23505` = duplicate.
- Copilot tools: `CopilotTool` from `@vantera/help-agent`, registered in `buildAccountTools()` in `apps/web/src/server/copilot/tools.ts`; read-tool DTO functions in `read-tools.ts`.
- Migrations: live in `packages/db/migrations/`, RLS + column grants in the same file (see `0001`), `is_account_admin(id)` helper exists. **Use the `vantera-db-migrations` skill when writing the migration task.**

---

## File Structure

**New package `packages/billing/`:**
- `package.json`, `tsconfig.json` — package scaffold.
- `src/plans.ts` — `PlanTier`, `PlanConfig`, `PLANS` config, `ADDON_PRICES`, helpers. Source of truth for limits + Stripe price IDs.
- `src/plans.test.ts`
- `src/entitlements.ts` — `EntitlementSnapshot`, `Limits`, `resolveEntitlements`, `checkLimit`, `isActive`.
- `src/entitlements.test.ts`
- `src/types.ts` — `BillingProvider` interface + request/result DTOs + `ParsedWebhookEvent`.
- `src/webhook.ts` — pure `snapshotFromEvent(event) → Partial<EntitlementSnapshot> | null` mapper.
- `src/webhook.test.ts`
- `src/in-memory.ts` — `InMemoryBilling` fake provider.
- `src/in-memory.test.ts`
- `src/stripe.ts` — `StripeBilling` adapter + `createBillingFromEnv()` (only file importing `stripe`).
- `src/index.ts` — public re-exports.

**DB:**
- `packages/db/migrations/0013_billing_entitlements.sql` — new account columns, `webhook_events.source` += `stripe`, grants.
- `packages/db/src/schema.ts` — mirror columns + enum.
- `packages/db/src/schema.test.ts` — grant guardrail for new billing columns (append).

**Web (`apps/web/src/`):**
- `lib/billing/entitlement.ts` — `loadAccountSnapshot(supabase) → EntitlementSnapshot`, `requireEntitlement(supabase, resource) → Valid<true> | Invalid`.
- `lib/billing/entitlement.test.ts`
- `server/billing-webhook.ts` — `handleStripeWebhook(rawBody, signature, deps)` (verify → idempotency → snapshot persist → lapse/unpause).
- `server/billing-webhook.test.ts`
- `app/api/webhooks/stripe/route.ts` — thin route.
- `app/(app)/settings/billing/page.tsx` — plan + usage + upgrade/manage.
- `app/(app)/settings/billing/actions.ts` — `startCheckout`, `openBillingPortal`.
- `app/(app)/settings/billing/billing-actions.tsx` — client buttons.
- `app/(app)/settings/team/page.tsx` — member list + invite form + pending invites.
- `app/(app)/settings/team/actions.ts` — `inviteMember`, `revokeInvite`, `changeRole`, `removeMember`.
- `app/(app)/settings/team/validation.ts` + `validation.test.ts` — invite input + seat-cap + permission checks.
- `app/(app)/settings/team/team-forms.tsx` — client forms.
- `app/invite/[token]/page.tsx` + `accept-actions.ts` — accept-invite flow.
- `server/copilot/read-tools.ts` (append `getBillingStatus`), `server/copilot/tools.ts` (register `getBillingStatus`).

**Help content:**
- `packages/help-content/content/billing.md`, `packages/help-content/content/team-seats.md`.

**Wire-in (modify existing create-paths):**
- `app/(app)/agents/actions.ts` — gate agent deploy/create.
- `app/(app)/settings/channels/actions.ts` — gate `provisionEmailSending` (mailboxes) and `createLinkedInConnectLink` (LinkedIn accounts).
- Team invite gate lives in the team action itself.

---

## Task 1: Scaffold the `packages/billing` package

**Files:**
- Create: `packages/billing/package.json`
- Create: `packages/billing/tsconfig.json`

- [ ] **Step 1: Create `package.json`** (mirror `packages/email-infra/package.json`; add the Stripe dep)

```json
{
  "name": "@vantera/billing",
  "version": "0.0.0",
  "private": true,
  "type": "module",
  "exports": {
    ".": "./src/index.ts"
  },
  "scripts": {
    "type-check": "tsc --noEmit",
    "test": "vitest run"
  },
  "dependencies": {
    "stripe": "^18.0.0"
  },
  "devDependencies": {
    "typescript": "^5.8.0",
    "vitest": "^4.0.0"
  }
}
```

- [ ] **Step 2: Create `tsconfig.json`** (copy `packages/email-infra/tsconfig.json` verbatim)

Run: `cat packages/email-infra/tsconfig.json` and write the same content to `packages/billing/tsconfig.json`.

- [ ] **Step 3: Install**

Run: `pnpm install`
Expected: adds `stripe` to `@vantera/billing`, no workspace errors.

- [ ] **Step 4: Commit**

```bash
git add packages/billing/package.json packages/billing/tsconfig.json pnpm-lock.yaml
git commit -m "chore(billing): scaffold @vantera/billing package"
```

---

## Task 2: Plan config (`plans.ts`)

**Files:**
- Create: `packages/billing/src/plans.ts`
- Test: `packages/billing/src/plans.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
import { describe, expect, it } from "vitest";
import { PLANS, ADDON_PRICES, planForPriceId, type PlanTier } from "./plans";

describe("plans config", () => {
  it("defines the three tiers with ascending base limits", () => {
    const tiers: PlanTier[] = ["starter", "growth", "scale"];
    for (const t of tiers) expect(PLANS[t]).toBeDefined();
    expect(PLANS.growth.maxCampaigns).toBeGreaterThan(PLANS.starter.maxCampaigns);
    expect(PLANS.scale.includedSeats).toBeGreaterThan(PLANS.growth.includedSeats);
  });

  it("maps a Stripe price id back to its tier", () => {
    const priceId = PLANS.growth.stripePriceId;
    expect(planForPriceId(priceId)).toBe("growth");
    expect(planForPriceId("price_does_not_exist")).toBeNull();
  });

  it("exposes the two add-on price ids", () => {
    expect(ADDON_PRICES.seat).toBeTruthy();
    expect(ADDON_PRICES.linkedinAccount).toBeTruthy();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --filter @vantera/billing test src/plans.test.ts`
Expected: FAIL — cannot find module `./plans`.

- [ ] **Step 3: Write the implementation**

```ts
// packages/billing/src/plans.ts

/** Internal tier identifiers. Display names + prices are Stripe-side. */
export type PlanTier = "starter" | "growth" | "scale";

export interface PlanConfig {
  tier: PlanTier;
  /** Stripe recurring price id for the base subscription (from env). */
  stripePriceId: string;
  /** Seats included before the per-seat add-on is billed. */
  includedSeats: number;
  maxMailboxes: number;
  maxCampaigns: number;
  /** Capability flags gated by tier. */
  features: { aiCaller: boolean; metaAds: boolean };
}

const env = (k: string): string => process.env[k] ?? `MISSING_${k}`;

export const PLANS: Record<PlanTier, PlanConfig> = {
  starter: {
    tier: "starter",
    stripePriceId: env("STRIPE_PRICE_STARTER"),
    includedSeats: 1,
    maxMailboxes: 3,
    maxCampaigns: 1,
    features: { aiCaller: false, metaAds: false },
  },
  growth: {
    tier: "growth",
    stripePriceId: env("STRIPE_PRICE_GROWTH"),
    includedSeats: 3,
    maxMailboxes: 9,
    maxCampaigns: 5,
    features: { aiCaller: false, metaAds: true },
  },
  scale: {
    tier: "scale",
    stripePriceId: env("STRIPE_PRICE_SCALE"),
    includedSeats: 10,
    maxMailboxes: 30,
    maxCampaigns: 25,
    features: { aiCaller: true, metaAds: true },
  },
};

/** Per-unit add-on price ids (Stripe quantity lines). */
export const ADDON_PRICES = {
  seat: env("STRIPE_PRICE_ADDON_SEAT"),
  linkedinAccount: env("STRIPE_PRICE_ADDON_LINKEDIN"),
} as const;

export function planForPriceId(priceId: string): PlanTier | null {
  const match = (Object.keys(PLANS) as PlanTier[]).find(
    (t) => PLANS[t].stripePriceId === priceId
  );
  return match ?? null;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm --filter @vantera/billing test src/plans.test.ts`
Expected: PASS (3 tests). Note: env price ids fall back to `MISSING_*` in tests, which is fine — the test reads `PLANS.growth.stripePriceId` and round-trips the same string.

- [ ] **Step 5: Commit**

```bash
git add packages/billing/src/plans.ts packages/billing/src/plans.test.ts
git commit -m "feat(billing): plan config (tiers, limits, Stripe price ids)"
```

---

## Task 3: Entitlement resolver (`entitlements.ts`)

**Files:**
- Create: `packages/billing/src/entitlements.ts`
- Test: `packages/billing/src/entitlements.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
import { describe, expect, it } from "vitest";
import {
  resolveEntitlements,
  checkLimit,
  isActive,
  type EntitlementSnapshot,
} from "./entitlements";

const base: EntitlementSnapshot = {
  plan: "growth",
  subscriptionStatus: "active",
  seatsPurchased: 2,
  linkedinAccountsPurchased: 1,
  currentPeriodEnd: "2026-07-13T00:00:00.000Z",
};

describe("resolveEntitlements", () => {
  it("adds purchased seats on top of the tier base", () => {
    const limits = resolveEntitlements(base);
    expect(limits.maxSeats).toBe(3 + 2); // growth base 3 + 2 add-on
    expect(limits.maxLinkedinAccounts).toBe(1);
    expect(limits.maxCampaigns).toBe(5);
  });

  it("grants nothing when there is no active plan", () => {
    const limits = resolveEntitlements({ ...base, plan: "none", subscriptionStatus: "none" });
    expect(limits.maxSeats).toBe(0);
    expect(limits.maxCampaigns).toBe(0);
    expect(limits.maxLinkedinAccounts).toBe(0);
  });

  it("treats past_due / canceled as inactive (no new capacity)", () => {
    expect(isActive("active")).toBe(true);
    expect(isActive("trialing")).toBe(true);
    expect(isActive("past_due")).toBe(false);
    expect(isActive("canceled")).toBe(false);
    expect(resolveEntitlements({ ...base, subscriptionStatus: "past_due" }).maxCampaigns).toBe(0);
  });
});

describe("checkLimit", () => {
  it("allows creating below the limit", () => {
    expect(checkLimit("campaign", 4, resolveEntitlements(base)).allowed).toBe(true);
  });
  it("blocks at the limit with a reason", () => {
    const res = checkLimit("campaign", 5, resolveEntitlements(base));
    expect(res.allowed).toBe(false);
    expect(res.reason).toMatch(/limit/i);
  });
  it("blocks everything when inactive", () => {
    const limits = resolveEntitlements({ ...base, subscriptionStatus: "canceled" });
    expect(checkLimit("campaign", 0, limits).allowed).toBe(false);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --filter @vantera/billing test src/entitlements.test.ts`
Expected: FAIL — cannot find module `./entitlements`.

- [ ] **Step 3: Write the implementation**

```ts
// packages/billing/src/entitlements.ts
import { PLANS, type PlanTier } from "./plans";

export type SubscriptionStatus =
  | "none"
  | "trialing"
  | "active"
  | "past_due"
  | "canceled";

export interface EntitlementSnapshot {
  plan: PlanTier | "none";
  subscriptionStatus: SubscriptionStatus;
  seatsPurchased: number;
  linkedinAccountsPurchased: number;
  currentPeriodEnd: string | null;
}

export interface Limits {
  maxSeats: number;
  maxMailboxes: number;
  maxCampaigns: number;
  maxLinkedinAccounts: number;
  features: { aiCaller: boolean; metaAds: boolean };
}

export type GatedResource = "seat" | "mailbox" | "campaign" | "linkedinAccount";

const EMPTY: Limits = {
  maxSeats: 0,
  maxMailboxes: 0,
  maxCampaigns: 0,
  maxLinkedinAccounts: 0,
  features: { aiCaller: false, metaAds: false },
};

export function isActive(status: SubscriptionStatus): boolean {
  return status === "active" || status === "trialing";
}

export function resolveEntitlements(snapshot: EntitlementSnapshot): Limits {
  if (snapshot.plan === "none" || !isActive(snapshot.subscriptionStatus)) {
    return EMPTY;
  }
  const plan = PLANS[snapshot.plan];
  return {
    maxSeats: plan.includedSeats + Math.max(0, snapshot.seatsPurchased),
    maxMailboxes: plan.maxMailboxes,
    maxCampaigns: plan.maxCampaigns,
    maxLinkedinAccounts: Math.max(0, snapshot.linkedinAccountsPurchased),
    features: plan.features,
  };
}

const LIMIT_FIELD: Record<GatedResource, keyof Limits> = {
  seat: "maxSeats",
  mailbox: "maxMailboxes",
  campaign: "maxCampaigns",
  linkedinAccount: "maxLinkedinAccounts",
};

export function checkLimit(
  resource: GatedResource,
  current: number,
  limits: Limits
): { allowed: boolean; reason?: string } {
  const max = limits[LIMIT_FIELD[resource]] as number;
  if (current >= max) {
    return {
      allowed: false,
      reason: `You've reached your plan limit for ${resource}s. Upgrade to add more.`,
    };
  }
  return { allowed: true };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm --filter @vantera/billing test src/entitlements.test.ts`
Expected: PASS (all cases).

- [ ] **Step 5: Commit**

```bash
git add packages/billing/src/entitlements.ts packages/billing/src/entitlements.test.ts
git commit -m "feat(billing): pure entitlement resolver + limit checks"
```

---

## Task 4: Provider interface + DTOs (`types.ts`)

**Files:**
- Create: `packages/billing/src/types.ts`

- [ ] **Step 1: Write the interface** (no test — type-only file, exercised by Tasks 5–7)

```ts
// packages/billing/src/types.ts
import type { PlanTier } from "./plans";
import type { SubscriptionStatus } from "./entitlements";

export interface CheckoutRequest {
  accountId: string;
  /** Stripe customer id if one already exists; provider creates one otherwise. */
  stripeCustomerId: string | null;
  customerEmail: string;
  tier: PlanTier;
  /** Extra seats beyond the tier base (quantity line). */
  seatAddons: number;
  /** LinkedIn-account quantity line. */
  linkedinAddons: number;
  successUrl: string;
  cancelUrl: string;
}

export interface PortalRequest {
  stripeCustomerId: string;
  returnUrl: string;
}

export interface SessionResult {
  url: string;
}

/** Vendor-neutral webhook event after verification + parse. */
export type ParsedWebhookEvent =
  | {
      type: "subscription_updated";
      stripeCustomerId: string;
      stripeSubscriptionId: string;
      status: SubscriptionStatus;
      /** Base-plan price id (maps to a tier via plans.planForPriceId). */
      planPriceId: string | null;
      seatsPurchased: number;
      linkedinAccountsPurchased: number;
      currentPeriodEnd: string | null;
    }
  | { type: "subscription_canceled"; stripeCustomerId: string; stripeSubscriptionId: string }
  | { type: "ignored" };

export interface BillingProvider {
  createCheckoutSession(req: CheckoutRequest): Promise<SessionResult>;
  createPortalSession(req: PortalRequest): Promise<SessionResult>;
  /** Throw if the signature is invalid; otherwise return the raw provider event. */
  verifyWebhook(rawBody: string, signature: string): unknown;
  /** Pull the provider event id used for idempotency. */
  webhookEventId(rawEvent: unknown): string | null;
  /** Map a verified raw event to the vendor-neutral shape. */
  parseWebhook(rawEvent: unknown): ParsedWebhookEvent;
}
```

- [ ] **Step 2: Type-check**

Run: `pnpm --filter @vantera/billing type-check`
Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add packages/billing/src/types.ts
git commit -m "feat(billing): BillingProvider interface + DTOs"
```

---

## Task 5: Webhook event → snapshot mapper (`webhook.ts`)

**Files:**
- Create: `packages/billing/src/webhook.ts`
- Test: `packages/billing/src/webhook.test.ts`

This is the pure translation from a `ParsedWebhookEvent` to the columns we persist. It depends on nothing async — easy to test exhaustively.

- [ ] **Step 1: Write the failing test**

```ts
import { describe, expect, it } from "vitest";
import { snapshotFromEvent } from "./webhook";
import { PLANS } from "./plans";
import type { ParsedWebhookEvent } from "./types";

describe("snapshotFromEvent", () => {
  it("maps a subscription_updated event to a full snapshot", () => {
    const event: ParsedWebhookEvent = {
      type: "subscription_updated",
      stripeCustomerId: "cus_1",
      stripeSubscriptionId: "sub_1",
      status: "active",
      planPriceId: PLANS.growth.stripePriceId,
      seatsPurchased: 2,
      linkedinAccountsPurchased: 1,
      currentPeriodEnd: "2026-07-13T00:00:00.000Z",
    };
    expect(snapshotFromEvent(event)).toEqual({
      stripeCustomerId: "cus_1",
      stripeSubscriptionId: "sub_1",
      plan: "growth",
      subscriptionStatus: "active",
      seatsPurchased: 2,
      linkedinAccountsPurchased: 1,
      currentPeriodEnd: "2026-07-13T00:00:00.000Z",
    });
  });

  it("maps a cancellation to a none/canceled snapshot", () => {
    const snap = snapshotFromEvent({
      type: "subscription_canceled",
      stripeCustomerId: "cus_1",
      stripeSubscriptionId: "sub_1",
    });
    expect(snap).toMatchObject({ plan: "none", subscriptionStatus: "canceled" });
  });

  it("returns null for ignored events", () => {
    expect(snapshotFromEvent({ type: "ignored" })).toBeNull();
  });

  it("falls back to none plan when the price id is unknown", () => {
    const snap = snapshotFromEvent({
      type: "subscription_updated",
      stripeCustomerId: "cus_1",
      stripeSubscriptionId: "sub_1",
      status: "active",
      planPriceId: "price_unknown",
      seatsPurchased: 0,
      linkedinAccountsPurchased: 0,
      currentPeriodEnd: null,
    });
    expect(snap?.plan).toBe("none");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --filter @vantera/billing test src/webhook.test.ts`
Expected: FAIL — cannot find module `./webhook`.

- [ ] **Step 3: Write the implementation**

```ts
// packages/billing/src/webhook.ts
import { planForPriceId, type PlanTier } from "./plans";
import type { SubscriptionStatus } from "./entitlements";
import type { ParsedWebhookEvent } from "./types";

export interface PersistedSnapshot {
  stripeCustomerId: string;
  stripeSubscriptionId: string;
  plan: PlanTier | "none";
  subscriptionStatus: SubscriptionStatus;
  seatsPurchased: number;
  linkedinAccountsPurchased: number;
  currentPeriodEnd: string | null;
}

/** Pure: translate a verified event into the columns to write, or null to skip. */
export function snapshotFromEvent(event: ParsedWebhookEvent): PersistedSnapshot | null {
  if (event.type === "ignored") return null;

  if (event.type === "subscription_canceled") {
    return {
      stripeCustomerId: event.stripeCustomerId,
      stripeSubscriptionId: event.stripeSubscriptionId,
      plan: "none",
      subscriptionStatus: "canceled",
      seatsPurchased: 0,
      linkedinAccountsPurchased: 0,
      currentPeriodEnd: null,
    };
  }

  const tier = event.planPriceId ? planForPriceId(event.planPriceId) : null;
  return {
    stripeCustomerId: event.stripeCustomerId,
    stripeSubscriptionId: event.stripeSubscriptionId,
    plan: tier ?? "none",
    subscriptionStatus: event.status,
    seatsPurchased: event.seatsPurchased,
    linkedinAccountsPurchased: event.linkedinAccountsPurchased,
    currentPeriodEnd: event.currentPeriodEnd,
  };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm --filter @vantera/billing test src/webhook.test.ts`
Expected: PASS (4 tests).

- [ ] **Step 5: Commit**

```bash
git add packages/billing/src/webhook.ts packages/billing/src/webhook.test.ts
git commit -m "feat(billing): pure webhook event -> snapshot mapper"
```

---

## Task 6: In-memory fake provider (`in-memory.ts`)

**Files:**
- Create: `packages/billing/src/in-memory.ts`
- Test: `packages/billing/src/in-memory.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
import { describe, expect, it } from "vitest";
import { InMemoryBilling } from "./in-memory";
import { PLANS } from "./plans";

describe("InMemoryBilling", () => {
  const provider = new InMemoryBilling("whsec_test");

  it("returns a checkout url", async () => {
    const { url } = await provider.createCheckoutSession({
      accountId: "acc_1",
      stripeCustomerId: null,
      customerEmail: "a@b.com",
      tier: "growth",
      seatAddons: 0,
      linkedinAddons: 0,
      successUrl: "https://app/ok",
      cancelUrl: "https://app/no",
    });
    expect(url).toContain("https://");
  });

  it("returns a portal url", async () => {
    const { url } = await provider.createPortalSession({
      stripeCustomerId: "cus_1",
      returnUrl: "https://app/billing",
    });
    expect(url).toContain("https://");
  });

  it("verifies by plain signature equality and rejects forgeries", () => {
    const body = JSON.stringify({ id: "evt_1", type: "subscription_updated" });
    expect(() => provider.verifyWebhook(body, "whsec_test")).not.toThrow();
    expect(() => provider.verifyWebhook(body, "wrong")).toThrow();
  });

  it("parses a fake subscription_updated event", () => {
    const raw = {
      id: "evt_2",
      type: "subscription_updated",
      customer: "cus_9",
      subscription: "sub_9",
      status: "active",
      planPriceId: PLANS.starter.stripePriceId,
      seats: 0,
      linkedin: 0,
      currentPeriodEnd: "2026-07-13T00:00:00.000Z",
    };
    expect(provider.webhookEventId(raw)).toBe("evt_2");
    const parsed = provider.parseWebhook(raw);
    expect(parsed).toMatchObject({ type: "subscription_updated", stripeCustomerId: "cus_9" });
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --filter @vantera/billing test src/in-memory.test.ts`
Expected: FAIL — cannot find module `./in-memory`.

- [ ] **Step 3: Write the implementation**

```ts
// packages/billing/src/in-memory.ts
import type {
  BillingProvider,
  CheckoutRequest,
  ParsedWebhookEvent,
  PortalRequest,
  SessionResult,
} from "./types";
import type { SubscriptionStatus } from "./entitlements";

/** Test/dev double. Mirrors StripeBilling's behavior contract. */
export class InMemoryBilling implements BillingProvider {
  readonly checkouts: CheckoutRequest[] = [];
  constructor(private readonly webhookSecret = "in-memory-whsec") {}

  async createCheckoutSession(req: CheckoutRequest): Promise<SessionResult> {
    this.checkouts.push(req);
    return { url: `https://checkout.test/${req.tier}?account=${req.accountId}` };
  }

  async createPortalSession(req: PortalRequest): Promise<SessionResult> {
    return { url: `https://portal.test/${req.stripeCustomerId}` };
  }

  // fake: plain equality; the real adapter uses Stripe's HMAC verification
  verifyWebhook(rawBody: string, signature: string): unknown {
    if (signature !== this.webhookSecret) throw new Error("invalid signature");
    return JSON.parse(rawBody);
  }

  webhookEventId(rawEvent: unknown): string | null {
    const e = rawEvent as Record<string, unknown>;
    return typeof e?.id === "string" ? e.id : null;
  }

  parseWebhook(rawEvent: unknown): ParsedWebhookEvent {
    const e = rawEvent as Record<string, unknown>;
    if (e?.type === "subscription_canceled") {
      return {
        type: "subscription_canceled",
        stripeCustomerId: String(e.customer),
        stripeSubscriptionId: String(e.subscription),
      };
    }
    if (e?.type === "subscription_updated") {
      return {
        type: "subscription_updated",
        stripeCustomerId: String(e.customer),
        stripeSubscriptionId: String(e.subscription),
        status: e.status as SubscriptionStatus,
        planPriceId: (e.planPriceId as string) ?? null,
        seatsPurchased: Number(e.seats ?? 0),
        linkedinAccountsPurchased: Number(e.linkedin ?? 0),
        currentPeriodEnd: (e.currentPeriodEnd as string) ?? null,
      };
    }
    return { type: "ignored" };
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm --filter @vantera/billing test src/in-memory.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add packages/billing/src/in-memory.ts packages/billing/src/in-memory.test.ts
git commit -m "feat(billing): in-memory billing provider fake"
```

---

## Task 7: Stripe adapter + env factory + index (`stripe.ts`, `index.ts`)

**Files:**
- Create: `packages/billing/src/stripe.ts`
- Create: `packages/billing/src/index.ts`
- Test: `packages/billing/src/stripe.test.ts` (parse-only; no live HTTP)

- [ ] **Step 1: Write the failing test** (covers the pure `parseWebhook` mapping from a Stripe-shaped object; checkout/portal are thin SDK wrappers verified by type-check + the live smoke test)

```ts
import { describe, expect, it } from "vitest";
import { StripeBilling } from "./stripe";
import { PLANS, ADDON_PRICES } from "./plans";

const adapter = new StripeBilling("sk_test_x", "whsec_x");

describe("StripeBilling.parseWebhook", () => {
  it("maps customer.subscription.updated to subscription_updated with add-on quantities", () => {
    const raw = {
      id: "evt_1",
      type: "customer.subscription.updated",
      data: {
        object: {
          customer: "cus_1",
          id: "sub_1",
          status: "active",
          current_period_end: 1768262400, // 2026-01-13T00:00:00Z (unix seconds)
          items: {
            data: [
              { price: { id: PLANS.growth.stripePriceId }, quantity: 1 },
              { price: { id: ADDON_PRICES.seat }, quantity: 2 },
              { price: { id: ADDON_PRICES.linkedinAccount }, quantity: 1 },
            ],
          },
        },
      },
    };
    const parsed = adapter.parseWebhook(raw);
    expect(parsed).toMatchObject({
      type: "subscription_updated",
      stripeCustomerId: "cus_1",
      stripeSubscriptionId: "sub_1",
      status: "active",
      planPriceId: PLANS.growth.stripePriceId,
      seatsPurchased: 2,
      linkedinAccountsPurchased: 1,
    });
  });

  it("maps customer.subscription.deleted to subscription_canceled", () => {
    const parsed = adapter.parseWebhook({
      id: "evt_2",
      type: "customer.subscription.deleted",
      data: { object: { customer: "cus_1", id: "sub_1" } },
    });
    expect(parsed.type).toBe("subscription_canceled");
  });

  it("ignores unrelated events", () => {
    expect(adapter.parseWebhook({ id: "e", type: "charge.succeeded", data: { object: {} } }).type).toBe("ignored");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --filter @vantera/billing test src/stripe.test.ts`
Expected: FAIL — cannot find module `./stripe`.

- [ ] **Step 3: Write the implementation**

```ts
// packages/billing/src/stripe.ts
import Stripe from "stripe";
import { ADDON_PRICES, PLANS } from "./plans";
import type { SubscriptionStatus } from "./entitlements";
import type {
  BillingProvider,
  CheckoutRequest,
  ParsedWebhookEvent,
  PortalRequest,
  SessionResult,
} from "./types";

const STATUS_MAP: Record<string, SubscriptionStatus> = {
  trialing: "trialing",
  active: "active",
  past_due: "past_due",
  unpaid: "past_due",
  canceled: "canceled",
  incomplete_expired: "canceled",
};

export class StripeBilling implements BillingProvider {
  private readonly stripe: Stripe;
  constructor(secretKey: string, private readonly webhookSecret: string) {
    this.stripe = new Stripe(secretKey);
  }

  async createCheckoutSession(req: CheckoutRequest): Promise<SessionResult> {
    const line_items: Stripe.Checkout.SessionCreateParams.LineItem[] = [
      { price: PLANS[req.tier].stripePriceId, quantity: 1 },
    ];
    if (req.seatAddons > 0) line_items.push({ price: ADDON_PRICES.seat, quantity: req.seatAddons });
    if (req.linkedinAddons > 0)
      line_items.push({ price: ADDON_PRICES.linkedinAccount, quantity: req.linkedinAddons });

    const session = await this.stripe.checkout.sessions.create({
      mode: "subscription",
      line_items,
      customer: req.stripeCustomerId ?? undefined,
      customer_email: req.stripeCustomerId ? undefined : req.customerEmail,
      client_reference_id: req.accountId,
      success_url: req.successUrl,
      cancel_url: req.cancelUrl,
      subscription_data: { metadata: { accountId: req.accountId } },
    });
    if (!session.url) throw new Error("stripe checkout: no url");
    return { url: session.url };
  }

  async createPortalSession(req: PortalRequest): Promise<SessionResult> {
    const session = await this.stripe.billingPortal.sessions.create({
      customer: req.stripeCustomerId,
      return_url: req.returnUrl,
    });
    return { url: session.url };
  }

  verifyWebhook(rawBody: string, signature: string): unknown {
    return this.stripe.webhooks.constructEvent(rawBody, signature, this.webhookSecret);
  }

  webhookEventId(rawEvent: unknown): string | null {
    const e = rawEvent as { id?: string };
    return typeof e.id === "string" ? e.id : null;
  }

  parseWebhook(rawEvent: unknown): ParsedWebhookEvent {
    const event = rawEvent as Stripe.Event;
    if (event.type === "customer.subscription.deleted") {
      const sub = event.data.object as Stripe.Subscription;
      return {
        type: "subscription_canceled",
        stripeCustomerId: String(sub.customer),
        stripeSubscriptionId: sub.id,
      };
    }
    if (
      event.type === "customer.subscription.created" ||
      event.type === "customer.subscription.updated"
    ) {
      const sub = event.data.object as Stripe.Subscription;
      const items = sub.items.data;
      const planItem = items.find((i) => PLANS_PRICE_IDS.has(i.price.id));
      const seatItem = items.find((i) => i.price.id === ADDON_PRICES.seat);
      const liItem = items.find((i) => i.price.id === ADDON_PRICES.linkedinAccount);
      return {
        type: "subscription_updated",
        stripeCustomerId: String(sub.customer),
        stripeSubscriptionId: sub.id,
        status: STATUS_MAP[sub.status] ?? "canceled",
        planPriceId: planItem?.price.id ?? null,
        seatsPurchased: seatItem?.quantity ?? 0,
        linkedinAccountsPurchased: liItem?.quantity ?? 0,
        currentPeriodEnd: sub.current_period_end
          ? new Date(sub.current_period_end * 1000).toISOString()
          : null,
      };
    }
    return { type: "ignored" };
  }
}

const PLANS_PRICE_IDS = new Set(Object.values(PLANS).map((p) => p.stripePriceId));

export function createBillingFromEnv(): BillingProvider {
  const key = process.env.STRIPE_SECRET_KEY;
  const whsec = process.env.STRIPE_WEBHOOK_SECRET;
  if (!key || !whsec) throw new Error("Stripe env not configured (STRIPE_SECRET_KEY/STRIPE_WEBHOOK_SECRET)");
  return new StripeBilling(key, whsec);
}
```

- [ ] **Step 4: Write `index.ts`**

```ts
// packages/billing/src/index.ts
export * from "./plans";
export * from "./entitlements";
export * from "./types";
export { snapshotFromEvent, type PersistedSnapshot } from "./webhook";
export { InMemoryBilling } from "./in-memory";
export { StripeBilling, createBillingFromEnv } from "./stripe";
```

- [ ] **Step 5: Run tests + type-check**

Run: `pnpm --filter @vantera/billing test && pnpm --filter @vantera/billing type-check`
Expected: PASS. (`current_period_end` lives on the Stripe subscription object; if the installed `stripe` types put it on items, adjust the access path — verify against `node_modules/stripe` types at implementation time.)

- [ ] **Step 6: Commit**

```bash
git add packages/billing/src/stripe.ts packages/billing/src/index.ts packages/billing/src/stripe.test.ts
git commit -m "feat(billing): Stripe adapter, webhook parsing, env factory + index"
```

---

## Task 8: Migration `0013` — billing columns, stripe webhook source, grants

**Files:**
- Create: `packages/db/migrations/0013_billing_entitlements.sql`
- Modify: `packages/db/src/schema.ts` (accounts columns + webhook_events enum)
- Test: `packages/db/src/schema.test.ts` (append grant guardrail)

**REQUIRED SUB-SKILL:** invoke `vantera-db-migrations` before writing this migration; run the `rls-auditor` review on the diff before commit.

- [ ] **Step 1: Write the migration SQL**

```sql
-- packages/db/migrations/0013_billing_entitlements.sql
-- Phase 7: subscription entitlement snapshot + Stripe webhook idempotency source.
-- Snapshot is server-managed (written only by the Stripe webhook via the service role);
-- clients can never write these columns (column grants below).

alter table public.accounts
  add column plan text not null default 'none'
    check (plan in ('none','starter','growth','scale')),
  add column subscription_status text not null default 'none'
    check (subscription_status in ('none','trialing','active','past_due','canceled')),
  add column seats_purchased integer not null default 0,
  add column linkedin_accounts_purchased integer not null default 0,
  add column current_period_end timestamptz;

-- Column grants: the authenticated client may still update only the profile/onboarding
-- fields granted in 0001. Re-issue that exact grant so the new billing columns are
-- NOT writable by clients (grant is column-scoped; adding columns does not widen it,
-- but we restate it to keep the allowed set explicit and self-documenting).
revoke update on table public.accounts from anon, authenticated;
grant update (name, onboarding_industry, onboarding_icp, revenue_goal_cents,
  onboarding_completed_at, sender_address, avg_deal_value_cents, website_url, outreach_paused)
  on public.accounts to authenticated;

-- Stripe joins the webhook idempotency table (same dedupe pattern as email/linkedin).
alter table public.webhook_events
  drop constraint if exists webhook_events_source_check;
alter table public.webhook_events
  add constraint webhook_events_source_check
  check (source in ('email','linkedin','stripe'));
```

> Note: confirm the live `outreach_paused` / `sender_address` / `avg_deal_value_cents` grant set against migrations `0001`/`0009`/`0012` when writing — the granted column list must equal the union of all previously client-writable account columns plus nothing new. If `webhook_events.source` has no named check constraint, add one named `webhook_events_source_check` (the `drop ... if exists` makes this idempotent).

- [ ] **Step 2: Mirror in Drizzle schema** — in `packages/db/src/schema.ts`, add to the `accounts` table after `senderAddress`:

```ts
  // 0013: subscription entitlement snapshot (server-managed; Stripe webhook only)
  plan: text("plan", { enum: ["none", "starter", "growth", "scale"] })
    .notNull()
    .default("none"),
  subscriptionStatus: text("subscription_status", {
    enum: ["none", "trialing", "active", "past_due", "canceled"],
  })
    .notNull()
    .default("none"),
  seatsPurchased: integer("seats_purchased").notNull().default(0),
  linkedinAccountsPurchased: integer("linkedin_accounts_purchased").notNull().default(0),
  currentPeriodEnd: timestamp("current_period_end", { withTimezone: true }),
```

And update the `webhookEvents.source` enum to `["email", "linkedin", "stripe"]`. (Ensure `integer` is imported from `drizzle-orm/pg-core` — it already is, used by `leads.aiScore`.)

- [ ] **Step 3: Add the grant guardrail test** — append to `packages/db/src/schema.test.ts` a test asserting the billing columns are absent from the authenticated UPDATE grant. Match the file's existing style for reading migration SQL; e.g.:

```ts
it("0013: billing snapshot columns are not client-writable", () => {
  const sql = readFileSync(
    new URL("../migrations/0013_billing_entitlements.sql", import.meta.url),
    "utf8"
  );
  const grantMatch = sql.match(/grant update \(([^)]*)\)\s+on table public\.accounts/i);
  expect(grantMatch, "expected a column-scoped accounts UPDATE grant").toBeTruthy();
  const granted = grantMatch![1];
  for (const col of ["plan", "subscription_status", "seats_purchased", "linkedin_accounts_purchased", "current_period_end"]) {
    expect(granted).not.toContain(col);
  }
});
```

(Use the same `readFileSync`/`import.meta.url` approach already present in `schema.test.ts`; if it reads migrations differently, follow that convention.)

- [ ] **Step 4: Run the schema tests**

Run: `pnpm --filter @vantera/db test`
Expected: PASS, including the new guardrail.

- [ ] **Step 5: Apply the migration locally + regenerate types**

Run the repo's migration apply command (per `vantera-db-migrations`). Then verify the columns exist.
Expected: migration applies cleanly, no ordering errors.

- [ ] **Step 6: Commit**

```bash
git add packages/db/migrations/0013_billing_entitlements.sql packages/db/src/schema.ts packages/db/src/schema.test.ts
git commit -m "feat(db): 0013 billing entitlement snapshot + stripe webhook source (RLS grants + guardrail)"
```

---

## Task 9: Entitlement loader + `requireEntitlement` (web)

**Files:**
- Create: `apps/web/src/lib/billing/entitlement.ts`
- Test: `apps/web/src/lib/billing/entitlement.test.ts`

This bridges the DB snapshot to the pure resolver and provides the single gate helper. Current-usage counts are passed in by callers (they already query their own tables), keeping this function pure-ish and testable with a fake supabase.

- [ ] **Step 1: Write the failing test**

```ts
import { describe, expect, it } from "vitest";
import { snapshotFromRow, gate } from "./entitlement";

describe("snapshotFromRow", () => {
  it("maps snake_case account row to the entitlement snapshot", () => {
    const snap = snapshotFromRow({
      plan: "growth",
      subscription_status: "active",
      seats_purchased: 1,
      linkedin_accounts_purchased: 0,
      current_period_end: "2026-07-13T00:00:00.000Z",
    });
    expect(snap).toEqual({
      plan: "growth",
      subscriptionStatus: "active",
      seatsPurchased: 1,
      linkedinAccountsPurchased: 0,
      currentPeriodEnd: "2026-07-13T00:00:00.000Z",
    });
  });
});

describe("gate", () => {
  const activeRow = {
    plan: "starter",
    subscription_status: "active",
    seats_purchased: 0,
    linkedin_accounts_purchased: 0,
    current_period_end: null,
  };
  it("allows creating a campaign under the limit", () => {
    expect(gate(activeRow, "campaign", 0).ok).toBe(true); // starter maxCampaigns = 1
  });
  it("blocks at the limit", () => {
    const res = gate(activeRow, "campaign", 1);
    expect(res.ok).toBe(false);
  });
  it("blocks when lapsed", () => {
    expect(gate({ ...activeRow, subscription_status: "past_due" }, "campaign", 0).ok).toBe(false);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --filter @vantera/web test src/lib/billing/entitlement.test.ts`
Expected: FAIL — cannot find module `./entitlement`.

- [ ] **Step 3: Write the implementation**

```ts
// apps/web/src/lib/billing/entitlement.ts
import {
  resolveEntitlements,
  checkLimit,
  type EntitlementSnapshot,
  type GatedResource,
} from "@vantera/billing";
import type { Valid, Invalid } from "@/lib/validation";

export interface AccountBillingRow {
  plan: string;
  subscription_status: string;
  seats_purchased: number;
  linkedin_accounts_purchased: number;
  current_period_end: string | null;
}

export function snapshotFromRow(row: AccountBillingRow): EntitlementSnapshot {
  return {
    plan: row.plan as EntitlementSnapshot["plan"],
    subscriptionStatus: row.subscription_status as EntitlementSnapshot["subscriptionStatus"],
    seatsPurchased: row.seats_purchased,
    linkedinAccountsPurchased: row.linkedin_accounts_purchased,
    currentPeriodEnd: row.current_period_end,
  };
}

/** Pure gate: returns the validation-style result the actions already use. */
export function gate(
  row: AccountBillingRow,
  resource: GatedResource,
  currentCount: number
): Valid<true> | Invalid {
  const limits = resolveEntitlements(snapshotFromRow(row));
  const res = checkLimit(resource, currentCount, limits);
  return res.allowed
    ? { ok: true, values: true }
    : { ok: false, error: res.reason ?? "Plan limit reached." };
}

const BILLING_COLS =
  "plan, subscription_status, seats_purchased, linkedin_accounts_purchased, current_period_end";

/** Server-side: load the account billing row via the RLS-scoped session client. */
export async function loadBillingRow(
  supabase: { from: (t: string) => any }
): Promise<AccountBillingRow | null> {
  const { data } = await supabase
    .from("accounts")
    .select(`id, ${BILLING_COLS}`)
    .limit(1)
    .maybeSingle();
  return data ?? null;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm --filter @vantera/web test src/lib/billing/entitlement.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/lib/billing/entitlement.ts apps/web/src/lib/billing/entitlement.test.ts
git commit -m "feat(web): entitlement loader + pure plan gate helper"
```

---

## Task 10: Webhook handler (`server/billing-webhook.ts`)

**Files:**
- Create: `apps/web/src/server/billing-webhook.ts`
- Test: `apps/web/src/server/billing-webhook.test.ts`

Pure handler with injected deps (provider + store), mirroring `@/server/inbound-webhooks`. Persists the snapshot, applies idempotency, and toggles `outreach_paused` on lapse/reactivation.

- [ ] **Step 1: Write the failing test**

```ts
import { describe, expect, it, vi } from "vitest";
import { handleStripeWebhook } from "./billing-webhook";
import { InMemoryBilling, PLANS } from "@vantera/billing";

function makeDeps(overrides: Partial<any> = {}) {
  const updates: any[] = [];
  return {
    updates,
    deps: {
      provider: new InMemoryBilling("whsec_test"),
      recordEvent: vi.fn(async () => true), // true = new, false = duplicate
      applySnapshot: vi.fn(async (snap: any) => {
        updates.push(snap);
      }),
      ...overrides,
    },
  };
}

const activeBody = JSON.stringify({
  id: "evt_1",
  type: "subscription_updated",
  customer: "cus_1",
  subscription: "sub_1",
  status: "active",
  planPriceId: PLANS.growth.stripePriceId,
  seats: 0,
  linkedin: 0,
  currentPeriodEnd: "2026-07-13T00:00:00.000Z",
});

describe("handleStripeWebhook", () => {
  it("rejects a bad signature with 401 and writes nothing", async () => {
    const { deps, updates } = makeDeps();
    const res = await handleStripeWebhook(activeBody, "wrong-sig", deps);
    expect(res.status).toBe(401);
    expect(updates).toHaveLength(0);
  });

  it("persists the snapshot for an active subscription (200)", async () => {
    const { deps, updates } = makeDeps();
    const res = await handleStripeWebhook(activeBody, "whsec_test", deps);
    expect(res.status).toBe(200);
    expect(updates[0]).toMatchObject({ plan: "growth", subscriptionStatus: "active", outreachPaused: false });
  });

  it("no-ops on a duplicate event", async () => {
    const { deps, updates } = makeDeps({ recordEvent: vi.fn(async () => false) });
    const res = await handleStripeWebhook(activeBody, "whsec_test", deps);
    expect(res.status).toBe(200);
    expect(updates).toHaveLength(0);
  });

  it("pauses outreach when the subscription lapses", async () => {
    const { deps, updates } = makeDeps();
    const body = JSON.stringify({ id: "evt_2", type: "subscription_canceled", customer: "cus_1", subscription: "sub_1" });
    await handleStripeWebhook(body, "whsec_test", deps);
    expect(updates[0]).toMatchObject({ subscriptionStatus: "canceled", outreachPaused: true });
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --filter @vantera/web test src/server/billing-webhook.test.ts`
Expected: FAIL — cannot find module `./billing-webhook`.

- [ ] **Step 3: Write the implementation**

```ts
// apps/web/src/server/billing-webhook.ts
import {
  isActive,
  snapshotFromEvent,
  type BillingProvider,
  type PersistedSnapshot,
} from "@vantera/billing";

export interface BillingWebhookDeps {
  provider: BillingProvider;
  /** Insert into webhook_events; return false if it's a duplicate (PG 23505). */
  recordEvent: (providerEventId: string, payload: unknown) => Promise<boolean>;
  /** Persist the snapshot to the matching account (by stripe_customer_id). */
  applySnapshot: (snapshot: PersistedSnapshot & { outreachPaused: boolean }) => Promise<void>;
}

export interface WebhookResponse {
  status: number;
  body: string;
}

export async function handleStripeWebhook(
  rawBody: string,
  signature: string,
  deps: BillingWebhookDeps
): Promise<WebhookResponse> {
  let rawEvent: unknown;
  try {
    rawEvent = deps.provider.verifyWebhook(rawBody, signature);
  } catch {
    return { status: 401, body: "invalid signature" };
  }

  const eventId = deps.provider.webhookEventId(rawEvent);
  if (!eventId) return { status: 400, body: "missing event id" };

  const isNew = await deps.recordEvent(eventId, rawEvent);
  if (!isNew) return { status: 200, body: "duplicate" };

  const parsed = deps.provider.parseWebhook(rawEvent);
  const snapshot = snapshotFromEvent(parsed);
  if (!snapshot) return { status: 200, body: "ignored" };

  // lapse → pause; reactivation → unpause. Existing data is untouched.
  await deps.applySnapshot({
    ...snapshot,
    outreachPaused: !isActive(snapshot.subscriptionStatus),
  });
  return { status: 200, body: "ok" };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm --filter @vantera/web test src/server/billing-webhook.test.ts`
Expected: PASS (4 tests).

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/server/billing-webhook.ts apps/web/src/server/billing-webhook.test.ts
git commit -m "feat(web): Stripe webhook handler — snapshot persist, idempotency, lapse->pause"
```

---

## Task 11: Webhook route (`api/webhooks/stripe/route.ts`)

**Files:**
- Create: `apps/web/src/app/api/webhooks/stripe/route.ts`

Thin route wiring real deps, mirroring `api/webhooks/email/route.ts`.

- [ ] **Step 1: Write the route**

```ts
// apps/web/src/app/api/webhooks/stripe/route.ts
import { createBillingFromEnv } from "@vantera/billing";
import { createServiceClient } from "@/lib/supabase/service";
import { handleStripeWebhook } from "@/server/billing-webhook";

export async function POST(req: Request) {
  const rawBody = await req.text();
  const signature = req.headers.get("stripe-signature") ?? "";
  const supabase = createServiceClient();

  const result = await handleStripeWebhook(rawBody, signature, {
    provider: createBillingFromEnv(),
    recordEvent: async (providerEventId, payload) => {
      const { error } = await supabase
        .from("webhook_events")
        .insert({ source: "stripe", provider_event_id: providerEventId, payload });
      if (error) {
        if (error.code === "23505") return false; // duplicate
        throw new Error(`webhook event store failed: ${error.code}`);
      }
      return true;
    },
    applySnapshot: async (snap) => {
      const { error } = await supabase
        .from("accounts")
        .update({
          plan: snap.plan,
          subscription_status: snap.subscriptionStatus,
          seats_purchased: snap.seatsPurchased,
          linkedin_accounts_purchased: snap.linkedinAccountsPurchased,
          current_period_end: snap.currentPeriodEnd,
          stripe_subscription_id: snap.stripeSubscriptionId,
          outreach_paused: snap.outreachPaused,
        })
        .eq("stripe_customer_id", snap.stripeCustomerId);
      if (error) throw new Error(`account snapshot update failed: ${error.code}`);
    },
  });

  return new Response(result.body, { status: result.status });
}
```

> The service client bypasses RLS (it's the only writer of these server-managed columns). `stripe_customer_id` is set at checkout creation (Task 12), so the `.eq` match resolves.

- [ ] **Step 2: Type-check**

Run: `pnpm --filter @vantera/web type-check`
Expected: PASS.

- [ ] **Step 3: Add env manifest entries** — append to `.env.example` (and the repo's real env dashboards out-of-band):

```
# Billing (Stripe) — Phase 7
STRIPE_SECRET_KEY=
STRIPE_WEBHOOK_SECRET=
STRIPE_PRICE_STARTER=
STRIPE_PRICE_GROWTH=
STRIPE_PRICE_SCALE=
STRIPE_PRICE_ADDON_SEAT=
STRIPE_PRICE_ADDON_LINKEDIN=
```

- [ ] **Step 4: Commit**

```bash
git add apps/web/src/app/api/webhooks/stripe/route.ts .env.example
git commit -m "feat(web): Stripe webhook route + billing env manifest"
```

---

## Task 12: Billing settings page + checkout/portal actions

**Files:**
- Create: `apps/web/src/app/(app)/settings/billing/actions.ts`
- Create: `apps/web/src/app/(app)/settings/billing/page.tsx`
- Create: `apps/web/src/app/(app)/settings/billing/billing-actions.tsx`

- [ ] **Step 1: Write the server actions**

```ts
// apps/web/src/app/(app)/settings/billing/actions.ts
"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createBillingFromEnv, type PlanTier } from "@vantera/billing";

function appUrl(path: string): string {
  return `${process.env.APP_URL ?? "http://localhost:3000"}${path}`;
}

export async function startCheckout(formData: FormData): Promise<void> {
  const tier = String(formData.get("tier") ?? "") as PlanTier;
  const seatAddons = Math.max(0, parseInt(String(formData.get("seatAddons") ?? "0"), 10) || 0);
  const linkedinAddons = Math.max(0, parseInt(String(formData.get("linkedinAddons") ?? "0"), 10) || 0);
  if (!["starter", "growth", "scale"].includes(tier)) return;

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: account } = await supabase
    .from("accounts")
    .select("id, stripe_customer_id")
    .limit(1)
    .maybeSingle<{ id: string; stripe_customer_id: string | null }>();
  if (!account) redirect("/login");

  const { url } = await createBillingFromEnv().createCheckoutSession({
    accountId: account.id,
    stripeCustomerId: account.stripe_customer_id,
    customerEmail: user.email ?? "",
    tier,
    seatAddons,
    linkedinAddons,
    successUrl: appUrl("/settings/billing?checkout=success"),
    cancelUrl: appUrl("/settings/billing?checkout=cancel"),
  });
  redirect(url);
}

export async function openBillingPortal(): Promise<void> {
  const supabase = await createClient();
  const { data: account } = await supabase
    .from("accounts")
    .select("stripe_customer_id")
    .limit(1)
    .maybeSingle<{ stripe_customer_id: string | null }>();
  if (!account?.stripe_customer_id) redirect("/settings/billing?portal=unavailable");

  const { url } = await createBillingFromEnv().createPortalSession({
    stripeCustomerId: account.stripe_customer_id,
    returnUrl: appUrl("/settings/billing"),
  });
  redirect(url);
}
```

> `stripe_customer_id` is null until the first checkout completes and the webhook writes it back (Task 11 sets `stripe_subscription_id`; extend `applySnapshot` to also set `stripe_customer_id` — already covered since the webhook matches by it. For the very first checkout, Stripe creates the customer from `customer_email`; the `checkout.session.completed`/`customer.subscription.created` event then carries the customer id, which `applySnapshot` writes via the `.eq("stripe_customer_id", ...)` match. **First-write caveat:** the initial match-by-customer-id will miss because the row has no customer id yet — see Step 2.)

- [ ] **Step 2: Handle the first-subscription customer-id linkage** — In `apps/web/src/server/billing-webhook.ts`, the `applySnapshot` deps function matches by `stripe_customer_id`. For the first subscription the account row has none yet. Resolve by also threading `client_reference_id` (the accountId, set in checkout) on `checkout.session.completed`. Add to the Stripe adapter `parseWebhook` a branch:

```ts
// in StripeBilling.parseWebhook, before the subscription branches:
if (event.type === "checkout.session.completed") {
  const s = event.data.object as Stripe.Checkout.Session;
  return {
    type: "subscription_updated",
    stripeCustomerId: String(s.customer),
    stripeSubscriptionId: String(s.subscription),
    status: "active",
    planPriceId: null,            // line items not expanded here; the subscription.created event fills tier
    seatsPurchased: 0,
    linkedinAccountsPurchased: 0,
    currentPeriodEnd: null,
    // accountId carried for first-link:
  };
}
```

And update `applySnapshot` in the route to match by `id = client_reference_id` when present. **Simpler, chosen approach:** set `stripe_customer_id` on the account at checkout-creation time is not possible (customer not yet created). Instead, in the route's `applySnapshot`, when the update-by-customer-id affects 0 rows, fall back to matching by the `accountId` carried in `subscription_data.metadata.accountId` (set in Task 7's checkout). Implement: extend `ParsedWebhookEvent.subscription_updated` with an optional `accountId?: string` populated from `sub.metadata.accountId`, and in the route update by `stripe_customer_id` OR (on 0 rows) by `id = accountId`, also writing `stripe_customer_id`.

Update the Task 7 `parseWebhook` subscription branch to include `accountId: sub.metadata?.accountId`. Update Task 10's `PersistedSnapshot` usage and the route's `applySnapshot` to accept and use `accountId`. Add a webhook-handler test: "first subscription links by metadata.accountId when customer id not yet stored."

- [ ] **Step 3: Write the page** (server component reading the snapshot + usage)

```tsx
// apps/web/src/app/(app)/settings/billing/page.tsx
import { getGateData } from "@/lib/auth/context";
import { createClient } from "@/lib/supabase/server";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { resolveEntitlements, PLANS, type PlanTier } from "@vantera/billing";
import { snapshotFromRow, type AccountBillingRow } from "@/lib/billing/entitlement";
import { CheckoutButtons, ManageBillingButton } from "./billing-actions";

export default async function BillingPage() {
  const { account } = await getGateData();
  if (!account) return null;

  const supabase = await createClient();
  const { data: row } = await supabase
    .from("accounts")
    .select("plan, subscription_status, seats_purchased, linkedin_accounts_purchased, current_period_end")
    .limit(1)
    .maybeSingle<AccountBillingRow>();

  const snap = row ? snapshotFromRow(row) : null;
  const limits = snap ? resolveEntitlements(snap) : null;

  const [{ count: seatCount }, { count: mailboxCount }, { count: campaignCount }, { count: liCount }] =
    await Promise.all([
      supabase.from("account_members").select("user_id", { count: "exact", head: true }),
      supabase.from("mailboxes").select("id", { count: "exact", head: true }),
      supabase.from("campaigns").select("id", { count: "exact", head: true }),
      supabase.from("linkedin_accounts").select("id", { count: "exact", head: true }),
    ]);

  const lapsed = snap ? ["past_due", "canceled"].includes(snap.subscriptionStatus) : false;

  return (
    <div className="flex max-w-2xl flex-col gap-6">
      <h1 className="text-2xl font-semibold tracking-tight">Billing</h1>

      {lapsed && (
        <Card className="border-destructive">
          <CardContent className="pt-6 text-sm">
            Your subscription needs attention — new outreach is paused until it's active again.
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader className="flex-row items-center justify-between">
          <CardTitle>Current plan</CardTitle>
          <Badge variant={snap?.subscriptionStatus === "active" ? "default" : "secondary"}>
            {snap?.plan === "none" ? "No plan" : `${snap?.plan} · ${snap?.subscriptionStatus}`}
          </Badge>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          {limits ? (
            <ul className="text-sm text-muted-foreground">
              <li>Seats: {seatCount ?? 0} / {limits.maxSeats}</li>
              <li>LinkedIn accounts: {liCount ?? 0} / {limits.maxLinkedinAccounts}</li>
              <li>Mailboxes: {mailboxCount ?? 0} / {limits.maxMailboxes}</li>
              <li>Campaigns: {campaignCount ?? 0} / {limits.maxCampaigns}</li>
            </ul>
          ) : null}
          {snap?.plan === "none" ? (
            <CheckoutButtons tiers={Object.keys(PLANS) as PlanTier[]} />
          ) : (
            <ManageBillingButton />
          )}
        </CardContent>
      </Card>
    </div>
  );
}
```

- [ ] **Step 4: Write the client buttons**

```tsx
// apps/web/src/app/(app)/settings/billing/billing-actions.tsx
"use client";

import { Button } from "@/components/ui/button";
import type { PlanTier } from "@vantera/billing";
import { startCheckout, openBillingPortal } from "./actions";

export function CheckoutButtons({ tiers }: { tiers: PlanTier[] }) {
  return (
    <div className="flex gap-2">
      {tiers.map((tier) => (
        <form key={tier} action={startCheckout}>
          <input type="hidden" name="tier" value={tier} />
          <Button type="submit" variant={tier === "growth" ? "default" : "outline"} size="sm">
            Choose {tier}
          </Button>
        </form>
      ))}
    </div>
  );
}

export function ManageBillingButton() {
  return (
    <form action={openBillingPortal}>
      <Button type="submit" variant="outline" size="sm">Manage billing</Button>
    </form>
  );
}
```

- [ ] **Step 5: Add a Billing card link** on `apps/web/src/app/(app)/settings/page.tsx` (a `<Card>` with a `Link href="/settings/billing"`, matching the Channels/Suppression cards).

- [ ] **Step 6: Type-check + lint**

Run: `pnpm --filter @vantera/web type-check && pnpm --filter @vantera/web lint`
Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add apps/web/src/app/\(app\)/settings/billing apps/web/src/app/\(app\)/settings/page.tsx apps/web/src/server/billing-webhook.ts apps/web/src/server/billing-webhook.test.ts packages/billing/src/stripe.ts packages/billing/src/types.ts
git commit -m "feat(web): billing settings page, checkout/portal actions, first-subscription account linkage"
```

---

## Task 13: Plan gates on the create-paths

**Files:**
- Modify: `apps/web/src/app/(app)/settings/channels/actions.ts` (mailbox provision + LinkedIn connect)
- Modify: `apps/web/src/app/(app)/agents/actions.ts` (campaign creation on deploy)

Insert the `gate()` check before each billable create. Each call already resolves `account` and queries current counts (or add the count query).

- [ ] **Step 1: Gate mailbox provisioning** — in `provisionEmailSending`, after loading `account` and `existingCount`, before calling the provider, load the billing row and gate on `mailbox`:

```ts
import { gate, loadBillingRow } from "@/lib/billing/entitlement";
// ...
const billingRow = await loadBillingRow(supabase);
if (!billingRow) return { error: "No active plan. Choose a plan in Billing first." };
const planGate = gate(billingRow, "mailbox", existingCount ?? 0);
if (!planGate.ok) return { error: planGate.error };
```

- [ ] **Step 2: Gate LinkedIn connect** — in `createLinkedInConnectLink`, after resolving `account`, count existing LinkedIn accounts and gate on `linkedinAccount`:

```ts
const { count: liCount } = await supabase
  .from("linkedin_accounts")
  .select("id", { count: "exact", head: true });
const billingRow = await loadBillingRow(supabase);
if (!billingRow) return { error: "No active plan. Choose a plan in Billing first." };
const planGate = gate(billingRow, "linkedinAccount", liCount ?? 0);
if (!planGate.ok) return { error: planGate.error };
```

- [ ] **Step 3: Gate campaign creation** — locate the agent-deploy action in `agents/actions.ts` that inserts a `campaigns` row (per rule 08, Outreach deploy auto-creates the campaign). Before that insert, count existing campaigns and gate on `campaign`:

```ts
const { count: campaignCount } = await supabase
  .from("campaigns")
  .select("id", { count: "exact", head: true });
const billingRow = await loadBillingRow(supabase);
if (!billingRow) return { error: "No active plan. Choose a plan in Billing first." };
const planGate = gate(billingRow, "campaign", campaignCount ?? 0);
if (!planGate.ok) return { error: planGate.error };
```

- [ ] **Step 4: Add an integration-style test** for one gate path to lock the wiring — `apps/web/src/app/(app)/settings/channels/actions.test.ts` is heavy to set up against Supabase; instead add a focused test that `gate()` is consulted by extracting the gate decision into the already-tested helper (Task 9 covers the logic). Confirm by running the full web test suite.

Run: `pnpm --filter @vantera/web test`
Expected: PASS (no regressions).

- [ ] **Step 5: Type-check + commit**

```bash
pnpm --filter @vantera/web type-check
git add apps/web/src/app/\(app\)/settings/channels/actions.ts apps/web/src/app/\(app\)/agents/actions.ts
git commit -m "feat(web): plan gates on mailbox/LinkedIn/campaign create-paths"
```

---

## Task 14: Team seat validation + actions

**Files:**
- Create: `apps/web/src/app/(app)/settings/team/validation.ts`
- Test: `apps/web/src/app/(app)/settings/team/validation.test.ts`
- Create: `apps/web/src/app/(app)/settings/team/actions.ts`

- [ ] **Step 1: Write the failing validation test**

```ts
import { describe, expect, it } from "vitest";
import { validateInvite, canManageTeam, seatCapReached } from "./validation";

describe("validateInvite", () => {
  it("requires a valid email and an allowed role", () => {
    expect(validateInvite({ email: "x@y.com", role: "member" }).ok).toBe(true);
    expect(validateInvite({ email: "nope", role: "member" }).ok).toBe(false);
    expect(validateInvite({ email: "x@y.com", role: "owner" }).ok).toBe(false); // owner not invitable
  });
});

describe("canManageTeam", () => {
  it("allows owner/admin, blocks member", () => {
    expect(canManageTeam("owner")).toBe(true);
    expect(canManageTeam("admin")).toBe(true);
    expect(canManageTeam("member")).toBe(false);
  });
});

describe("seatCapReached", () => {
  it("counts members + pending invites against maxSeats", () => {
    expect(seatCapReached(2, 1, 3)).toBe(true);  // 2 members + 1 pending = 3 >= 3
    expect(seatCapReached(1, 1, 3)).toBe(false);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --filter @vantera/web test src/app/\(app\)/settings/team/validation.test.ts`
Expected: FAIL — cannot find module `./validation`.

- [ ] **Step 3: Write the validation**

```ts
// apps/web/src/app/(app)/settings/team/validation.ts
import type { Valid, Invalid } from "@/lib/validation";

export type InviteRole = "admin" | "member";

export interface InviteValues {
  email: string;
  role: InviteRole;
}

const EMAIL_RE = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;

export function validateInvite(input: Record<string, unknown>): Valid<InviteValues> | Invalid {
  const email = String(input.email ?? "").trim().toLowerCase();
  const role = String(input.role ?? "");
  if (!EMAIL_RE.test(email)) return { ok: false, error: "Enter a valid email address." };
  if (role !== "admin" && role !== "member")
    return { ok: false, error: "Role must be admin or member." };
  return { ok: true, values: { email, role } };
}

export function canManageTeam(role: string): boolean {
  return role === "owner" || role === "admin";
}

/** Members already in the account + pending invites both consume a seat. */
export function seatCapReached(memberCount: number, pendingInvites: number, maxSeats: number): boolean {
  return memberCount + pendingInvites >= maxSeats;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm --filter @vantera/web test src/app/\(app\)/settings/team/validation.test.ts`
Expected: PASS.

- [ ] **Step 5: Write the actions** (invite/revoke/role/remove). Each resolves the caller's membership role for the permission check and uses the seat gate for invites.

```ts
// apps/web/src/app/(app)/settings/team/actions.ts
"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { sendInviteEmail } from "@vantera/transactional-email";
import { resolveEntitlements } from "@vantera/billing";
import { snapshotFromRow, type AccountBillingRow } from "@/lib/billing/entitlement";
import { validateInvite, canManageTeam, seatCapReached } from "./validation";

export type TeamActionState = { error?: string; success?: string };

async function callerContext() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { supabase, user: null, account: null, role: null };
  const { data: account } = await supabase
    .from("accounts")
    .select("id, plan, subscription_status, seats_purchased, linkedin_accounts_purchased, current_period_end")
    .limit(1)
    .maybeSingle();
  if (!account) return { supabase, user, account: null, role: null };
  const { data: membership } = await supabase
    .from("account_members")
    .select("role")
    .eq("account_id", account.id)
    .eq("user_id", user.id)
    .maybeSingle<{ role: string }>();
  return { supabase, user, account, role: membership?.role ?? null };
}

export async function inviteMember(
  _prev: TeamActionState,
  formData: FormData
): Promise<TeamActionState> {
  const parsed = validateInvite({ email: formData.get("email"), role: formData.get("role") });
  if (!parsed.ok) return { error: parsed.error };

  const { supabase, user, account, role } = await callerContext();
  if (!user || !account) return { error: "Your session expired. Sign in again." };
  if (!canManageTeam(role ?? "")) return { error: "Only owners and admins can invite teammates." };

  const limits = resolveEntitlements(snapshotFromRow(account as AccountBillingRow));
  const [{ count: members }, { count: pending }] = await Promise.all([
    supabase.from("account_members").select("user_id", { count: "exact", head: true }),
    supabase.from("account_invites").select("id", { count: "exact", head: true }).eq("status", "pending"),
  ]);
  if (seatCapReached(members ?? 0, pending ?? 0, limits.maxSeats))
    return { error: "You've used all your seats. Add seats or upgrade your plan in Billing." };

  const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();
  const { data: invite, error } = await supabase
    .from("account_invites")
    .insert({ account_id: account.id, email: parsed.values.email, role: parsed.values.role, invited_by: user.id, expires_at: expiresAt })
    .select("token")
    .single<{ token: string }>();
  if (error || !invite) return { error: "Could not send the invite. Try again shortly." };

  try {
    await sendInviteEmail({
      to: parsed.values.email,
      inviteUrl: `${process.env.APP_URL ?? "http://localhost:3000"}/invite/${invite.token}`,
      workspaceName: (account as { name?: string }).name ?? "your team",
    });
  } catch {
    // invite row exists; email retryable — surface a soft success
    return { success: "Invite created. If the email doesn't arrive, resend it." };
  }

  revalidatePath("/settings/team");
  return { success: `Invitation sent to ${parsed.values.email}.` };
}

export async function revokeInvite(
  _prev: TeamActionState,
  formData: FormData
): Promise<TeamActionState> {
  const inviteId = String(formData.get("inviteId") ?? "");
  const { supabase, account, role } = await callerContext();
  if (!account) return { error: "Your session expired. Sign in again." };
  if (!canManageTeam(role ?? "")) return { error: "Only owners and admins can manage invites." };
  const { error } = await supabase
    .from("account_invites")
    .update({ status: "revoked" })
    .eq("id", inviteId)
    .eq("account_id", account.id)
    .eq("status", "pending");
  if (error) return { error: "Could not revoke the invite." };
  revalidatePath("/settings/team");
  return { success: "Invite revoked." };
}

export async function removeMember(
  _prev: TeamActionState,
  formData: FormData
): Promise<TeamActionState> {
  const userId = String(formData.get("userId") ?? "");
  const { supabase, account, role } = await callerContext();
  if (!account) return { error: "Your session expired. Sign in again." };
  if (!canManageTeam(role ?? "")) return { error: "Only owners and admins can remove members." };
  // never remove an owner
  const { data: target } = await supabase
    .from("account_members")
    .select("role")
    .eq("account_id", account.id)
    .eq("user_id", userId)
    .maybeSingle<{ role: string }>();
  if (target?.role === "owner") return { error: "You can't remove the workspace owner." };
  const { error } = await supabase
    .from("account_members")
    .delete()
    .eq("account_id", account.id)
    .eq("user_id", userId);
  if (error) return { error: "Could not remove the member." };
  revalidatePath("/settings/team");
  return { success: "Member removed." };
}
```

> If `@vantera/transactional-email` has no `sendInviteEmail` export yet, add one in that package following its existing send helpers (a thin Resend template call). Verify its public API when implementing; adjust the import/signature to match.

- [ ] **Step 6: Run tests + type-check**

Run: `pnpm --filter @vantera/web test && pnpm --filter @vantera/web type-check`
Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add apps/web/src/app/\(app\)/settings/team/validation.ts apps/web/src/app/\(app\)/settings/team/validation.test.ts apps/web/src/app/\(app\)/settings/team/actions.ts
git commit -m "feat(web): team seat actions (invite/revoke/remove) + validation + seat-cap gate"
```

---

## Task 15: Team page UI + accept-invite flow

**Files:**
- Create: `apps/web/src/app/(app)/settings/team/page.tsx`
- Create: `apps/web/src/app/(app)/settings/team/team-forms.tsx`
- Create: `apps/web/src/app/invite/[token]/page.tsx`
- Create: `apps/web/src/app/invite/[token]/accept-actions.ts`
- Modify: `apps/web/src/app/(app)/settings/page.tsx` (Team card → link to `/settings/team`; drop "coming soon")

- [ ] **Step 1: Team page** (server component): list members with roles, pending invites with revoke buttons, and the invite form (gated UI: hide the form if `canManageTeam` is false). Read `account_members`, `account_invites` (status `pending`), and the seat usage like the billing page. Render `team-forms.tsx` client components bound to the Task 14 actions via `useActionState`.

- [ ] **Step 2: `team-forms.tsx`** (client): `InviteForm` (email input + role select + submit, shows action error/success), `RevokeButton`, `RemoveMemberButton` — each a `<form action={...}>` using `useActionState` (mirror `channels-forms.tsx`).

- [ ] **Step 3: Accept-invite action**

```ts
// apps/web/src/app/invite/[token]/accept-actions.ts
"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export async function acceptInvite(token: string): Promise<{ error?: string }> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect(`/login?next=/invite/${token}`);

  const { data: invite } = await supabase
    .from("account_invites")
    .select("id, account_id, email, role, status, expires_at")
    .eq("token", token)
    .maybeSingle<{ id: string; account_id: string; email: string; role: string; status: string; expires_at: string }>();

  if (!invite || invite.status !== "pending") return { error: "This invitation is no longer valid." };
  if (new Date(invite.expires_at) < new Date()) return { error: "This invitation has expired." };
  if ((user.email ?? "").toLowerCase() !== invite.email.toLowerCase())
    return { error: "This invitation was sent to a different email address." };

  // RLS note: accepting writes a membership for the *current* user into another account.
  // The accept path must run with a SECURITY DEFINER RPC or service client — a plain
  // authenticated insert is blocked by account_members RLS (user isn't a member yet).
  // Implement `accept_account_invite(token)` SECURITY DEFINER fn in this migration's
  // follow-up OR call the service client here. Chosen: service client (server-only).
  const { createServiceClient } = await import("@/lib/supabase/service");
  const svc = createServiceClient();
  const { error } = await svc.from("account_members").insert({
    account_id: invite.account_id,
    user_id: user.id,
    role: invite.role,
  });
  if (error && error.code !== "23505") return { error: "Could not join the workspace. Try again." };
  await svc.from("account_invites").update({ status: "accepted", accepted_at: new Date().toISOString() }).eq("id", invite.id);

  redirect("/dashboard");
}
```

> Verify `@/lib/supabase/service` `createServiceClient` exists (it's used by webhook routes — yes). The service-client insert is the pragmatic path; if the repo prefers a SECURITY DEFINER RPC, add `accept_account_invite(token uuid)` to migration `0013` instead and call it via `supabase.rpc`. Pick one and note it; do not leave both.

- [ ] **Step 4: Accept-invite page** (`invite/[token]/page.tsx`): a minimal focused card (rule 07 focused-surface spacing) showing the workspace name + an "Accept invitation" button calling `acceptInvite(token)`; renders the returned error inline.

- [ ] **Step 5: Update Settings Team card** to link to `/settings/team` and remove the "coming soon" line.

- [ ] **Step 6: Type-check + lint + manual smoke**

Run: `pnpm --filter @vantera/web type-check && pnpm --filter @vantera/web lint`
Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add apps/web/src/app/\(app\)/settings/team apps/web/src/app/invite apps/web/src/app/\(app\)/settings/page.tsx
git commit -m "feat(web): team management UI + accept-invite flow"
```

---

## Task 16: Copilot billing-status tool (rule 09)

**Files:**
- Modify: `apps/web/src/server/copilot/read-tools.ts` (add `getBillingStatus` + DTO)
- Test: `apps/web/src/server/copilot/read-tools.test.ts` (append)
- Modify: `apps/web/src/server/copilot/tools.ts` (register the read tool)

- [ ] **Step 1: Write the failing test** — append to `read-tools.test.ts`, following its existing fake-supabase pattern:

```ts
import { getBillingStatus } from "./read-tools";

it("getBillingStatus returns plan + usage, never raw rows", async () => {
  const db = {
    from: (t: string) => ({
      select: () => ({
        limit: () => ({ maybeSingle: async () => ({ data: { plan: "growth", subscription_status: "active", seats_purchased: 0, linkedin_accounts_purchased: 0, current_period_end: null } }) }),
      }),
      // count queries used for usage:
    }),
  } as any;
  const dto = await getBillingStatus(db, "acc_1");
  expect(dto.plan).toBe("growth");
  expect(dto).not.toHaveProperty("stripe_customer_id");
});
```

(Adjust the fake to satisfy the count queries the implementation makes; follow the existing read-tools test doubles.)

- [ ] **Step 2: Implement `getBillingStatus`** in `read-tools.ts`:

```ts
import { resolveEntitlements } from "@vantera/billing";
import { snapshotFromRow, type AccountBillingRow } from "@/lib/billing/entitlement";

export interface BillingStatusDTO {
  plan: string;
  status: string;
  seats: { used: number; max: number };
  campaigns: { used: number; max: number };
}

export async function getBillingStatus(db: SupabaseClient, _accountId: string): Promise<BillingStatusDTO> {
  const { data: row } = await db
    .from("accounts")
    .select("plan, subscription_status, seats_purchased, linkedin_accounts_purchased, current_period_end")
    .limit(1)
    .maybeSingle();
  const snap = snapshotFromRow((row ?? { plan: "none", subscription_status: "none", seats_purchased: 0, linkedin_accounts_purchased: 0, current_period_end: null }) as AccountBillingRow);
  const limits = resolveEntitlements(snap);
  const { count: seats } = await db.from("account_members").select("user_id", { count: "exact", head: true });
  const { count: campaigns } = await db.from("campaigns").select("id", { count: "exact", head: true });
  return {
    plan: snap.plan,
    status: snap.subscriptionStatus,
    seats: { used: seats ?? 0, max: limits.maxSeats },
    campaigns: { used: campaigns ?? 0, max: limits.maxCampaigns },
  };
}
```

- [ ] **Step 3: Register the tool** in `tools.ts` `buildAccountTools` (read tier only — billing is deep-link-only, no mutate):

```ts
import { getBillingStatus } from "./read-tools";
// add to the returned array:
{
  name: "getBillingStatus",
  tier: "read",
  description: "The account's current plan, subscription status, and seat/campaign usage vs. limits.",
  parameters: z.object({}),
  run: async () => getBillingStatus(db, accountId),
},
```

- [ ] **Step 4: Run tests + type-check**

Run: `pnpm --filter @vantera/web test src/server/copilot && pnpm --filter @vantera/web type-check`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/server/copilot/read-tools.ts apps/web/src/server/copilot/read-tools.test.ts apps/web/src/server/copilot/tools.ts
git commit -m "feat(copilot): read-tier billing status tool (deep-link-only billing, rule 09)"
```

---

## Task 17: Help content articles (rule 09 knowledge-sync)

**Files:**
- Create: `packages/help-content/content/billing.md`
- Create: `packages/help-content/content/team-seats.md`

- [ ] **Step 1: Write `billing.md`** with the frontmatter shape used by existing articles (check an existing file for exact `title`/`surface`/`routes` keys):

```md
---
title: Plans & billing
surface: settings
routes: ["/settings/billing"]
---

Vantera plans unlock the product and set your usage limits...
(Explain: tiers, what each includes, LinkedIn-account + seat add-ons, how to
upgrade/manage via the billing portal, what happens if a payment fails —
new outreach pauses, existing data is safe, reactivating restores access.)
```

- [ ] **Step 2: Write `team-seats.md`**:

```md
---
title: Team & seats
surface: settings
routes: ["/settings/team"]
---

Invite teammates, set their role (admin or member), and manage seats...
(Explain: roles, inviting, accepting, revoking, seat limits + add-ons, the
owner can't be removed.)
```

- [ ] **Step 3: Validate help-content build** — no vendor names beyond Stripe/the user's own tools; run the articles test:

Run: `pnpm --filter @vantera/help-content test`
Expected: PASS (incl. the no-vendor-names guard — Stripe is an allowed billing surface; do not name Smartlead/Unipile/Explorium).

- [ ] **Step 4: Commit**

```bash
git add packages/help-content/content/billing.md packages/help-content/content/team-seats.md
git commit -m "docs(help): billing + team-seats articles (knowledge-sync, rule 09)"
```

---

## Task 18: Full gate, roadmap flip, audits

**Files:**
- Modify: `docs/roadmap.md` (Phase 7 checkbox + build-state note)

- [ ] **Step 1: Run the full CI gate**

Run: `pnpm lint && pnpm type-check && pnpm test && pnpm build`
Expected: all green. Fix anything that fails before proceeding.

- [ ] **Step 2: Run the audit subagents** (rule 12): `rls-auditor` on the `0013` diff, `whitelabel-auditor` on the new user-facing surfaces (Stripe is the allowed exception; confirm no outreach-vendor names leak).

- [ ] **Step 3: Flip the roadmap** — change Phase 7 to `- [x]` and add a one-line build-state note (mirroring the Phase 5/6 entries), listing what shipped and any remaining live smoke test (Stripe test-mode checkout + webhook with owner keys).

- [ ] **Step 4: Commit**

```bash
git add docs/roadmap.md
git commit -m "docs(roadmap): Phase 7 (billing & team seats) build complete"
```

- [ ] **Step 5: Hand off to `/ship-phase`** for verification, knowledge-sync check, and merge.

---

## Notes for the implementer

- **TDD order matters**: the pure billing units (Tasks 2–7) are fully test-driven and have no external deps — do them first; they de-risk everything downstream.
- **The Stripe live smoke test** (test-mode checkout → webhook → snapshot) needs the owner's keys and cannot run in CI — it's a `/ship-phase` step, like Phases 5/6.
- **First-subscription linkage** (Task 12 Step 2) is the one fiddly bit: the account row has no `stripe_customer_id` until the first subscription, so the webhook must fall back to matching by `subscription_data.metadata.accountId`. The webhook-handler test must cover this path.
- **RLS**: only the service client (webhook, accept-invite) writes server-managed columns and cross-tenant membership rows; everything else stays on the RLS-scoped session client with account resolved from the session.

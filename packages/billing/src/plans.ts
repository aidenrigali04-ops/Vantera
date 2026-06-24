/** Internal tier identifiers. Display names + prices are Stripe-side. */
export type PlanTier = "starter" | "growth" | "scale";

/** Billing cadence — Stripe has a distinct recurring price per cadence. */
export type BillingInterval = "month" | "year";

export interface PlanConfig {
  tier: PlanTier;
  /** Stripe recurring price id for the monthly base subscription (from env). */
  stripePriceId: string;
  /** Stripe recurring price id for the annual base subscription (from env). */
  stripePriceIdAnnual: string;
  /** Seats included before the per-seat add-on is billed. */
  includedSeats: number;
  /** LinkedIn sender accounts included before the per-account add-on is billed. */
  includedLinkedinAccounts: number;
  maxCampaigns: number;
  /** Capability flags gated by tier. */
  features: { intent: boolean };
}

const env = (k: string): string => process.env[k] ?? `MISSING_${k}`;

export const PLANS: Record<PlanTier, PlanConfig> = {
  starter: {
    tier: "starter",
    stripePriceId: env("STRIPE_PRICE_STARTER"),
    stripePriceIdAnnual: env("STRIPE_PRICE_STARTER_ANNUAL"),
    includedSeats: 1,
    includedLinkedinAccounts: 1, // 1 sender — solo
    maxCampaigns: 2,
    features: { intent: false },
  },
  growth: {
    tier: "growth",
    stripePriceId: env("STRIPE_PRICE_GROWTH"),
    stripePriceIdAnnual: env("STRIPE_PRICE_GROWTH_ANNUAL"),
    includedSeats: 3,
    includedLinkedinAccounts: 5, // generous middle tier — multi-sender headline
    maxCampaigns: 10,
    features: { intent: true }, // Intent Agent available from Growth up (2026-06-24 restructure)
  },
  scale: {
    tier: "scale",
    stripePriceId: env("STRIPE_PRICE_SCALE"),
    stripePriceIdAnnual: env("STRIPE_PRICE_SCALE_ANNUAL"),
    includedSeats: 10,
    includedLinkedinAccounts: 15, // max sender capacity — what justifies Scale
    maxCampaigns: 999, // "Unlimited" in the UI
    features: { intent: true },
  },
};

/** The Stripe price id for a tier at a given cadence. */
export function priceIdFor(tier: PlanTier, interval: BillingInterval): string {
  return interval === "year" ? PLANS[tier].stripePriceIdAnnual : PLANS[tier].stripePriceId;
}

/** Per-unit add-on price ids (Stripe quantity lines). */
export const ADDON_PRICES = {
  seat: env("STRIPE_PRICE_ADDON_SEAT"),
  linkedinAccount: env("STRIPE_PRICE_ADDON_LINKEDIN"),
} as const;

/** Resolve a tier from either its monthly or its annual Stripe price id. */
export function planForPriceId(priceId: string): PlanTier | null {
  const match = (Object.keys(PLANS) as PlanTier[]).find(
    (t) => PLANS[t].stripePriceId === priceId || PLANS[t].stripePriceIdAnnual === priceId
  );
  return match ?? null;
}

/** Every base-plan price id (both cadences) — used to spot the plan line in a subscription. */
export const PLAN_PRICE_IDS: ReadonlySet<string> = new Set(
  (Object.keys(PLANS) as PlanTier[]).flatMap((t) => [
    PLANS[t].stripePriceId,
    PLANS[t].stripePriceIdAnnual,
  ])
);

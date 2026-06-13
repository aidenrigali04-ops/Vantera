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

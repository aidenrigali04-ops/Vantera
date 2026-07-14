import { PLANS, type PlanTier, type BillingInterval } from "./plans";

/**
 * Presentation source of truth for the pricing surface — display names, positioning,
 * monthly price, and value bullets. Kept separate from `plans.ts` (the entitlement
 * contract) so marketing copy never leaks into the gating logic. Capacity bullets are
 * DERIVED from `PLANS` so the numbers shown to a user can never drift from what the
 * entitlement engine actually enforces.
 *
 * Prices are display-only (USD, monthly). The amount actually charged is the Stripe
 * price behind `PLANS[tier].stripePriceId`; keep this in sync with the Stripe dashboard.
 */
export interface PlanDisplay {
  tier: PlanTier;
  name: string;
  /** One-line positioning shown under the plan name. */
  tagline: string;
  /** Monthly price in whole USD (display only). */
  monthlyUsd: number;
  /** The one plan the page should steer selection toward (center-stage). */
  highlight: boolean;
  /** Concrete value bullets — capability claims must match real entitlement flags. */
  features: string[];
}

/**
 * Capacity bullets pulled straight from the entitlement config — never hand-typed.
 * Senders lead: how many LinkedIn accounts run in parallel is the headline differentiator
 * (multi-sender distribution spreads volume so no one account trips LinkedIn's limits).
 */
function capacity(tier: PlanTier): string[] {
  const p = PLANS[tier];
  const campaigns =
    p.maxCampaigns >= 999
      ? "Unlimited active campaigns"
      : `${p.maxCampaigns} active campaign${p.maxCampaigns === 1 ? "" : "s"}`;
  return [
    `${p.includedLinkedinAccounts} LinkedIn sender${p.includedLinkedinAccounts === 1 ? "" : "s"} included`,
    `${p.includedSeats} team seat${p.includedSeats === 1 ? "" : "s"} included`,
    campaigns,
  ];
}

export const PLAN_DISPLAY: Record<PlanTier, PlanDisplay> = {
  starter: {
    tier: "starter",
    name: "Starter",
    tagline: "Prove the motion — one LinkedIn sender working your ICP, hands-off.",
    monthlyUsd: 45,
    highlight: false,
    features: [
      "Prospect & Outreach agents (LinkedIn)",
      // Vera's self-improving loop runs on EVERY tier (no entitlement gate) — the capability
      // claim is checked against the Stage 0 engine, not hand-waved (spec 2026-07-14).
      "Vera — self-improving outreach on proven plays",
      "ICP-tailored enrichment & lead scoring",
      ...capacity("starter"),
    ],
  },
  growth: {
    tier: "growth",
    name: "Growth",
    tagline: "The whole power system — five senders in parallel, plus the Intent Agent.",
    monthlyUsd: 79,
    highlight: true,
    features: [
      "Everything in Starter",
      "Intent Agent — LinkedIn-native buying-intent detection",
      "Multi-sender distribution across your connected accounts",
      ...capacity("growth"),
    ],
  },
  scale: {
    tier: "scale",
    name: "Scale",
    tagline: "Maximum reach — fifteen senders for teams and agencies running at volume.",
    monthlyUsd: 349,
    highlight: false,
    features: [
      "Everything in Growth, including the Intent Agent",
      "Priority enrichment & support",
      ...capacity("scale"),
    ],
  },
};

/** Render order, left → right. */
export const PLAN_DISPLAY_ORDER: PlanTier[] = ["starter", "growth", "scale"];

/** Annual billing gives two months free. Charged yearly; shown as an effective /mo. */
export const MONTHS_FREE_ANNUAL = 2;

/** Total charged once per year when billed annually (display only). */
export function annualYearlyUsd(monthlyUsd: number): number {
  return monthlyUsd * (12 - MONTHS_FREE_ANNUAL);
}

/** Effective monthly price when billed annually — the big number on the annual toggle. */
export function annualMonthlyUsd(monthlyUsd: number): number {
  return Math.round(annualYearlyUsd(monthlyUsd) / 12);
}

/**
 * Closed deals (at `dealValueUsd` each) needed to cover a year of this plan at the chosen
 * cadence — the honest payback line. Annual billing needs fewer (two months free). Returns
 * null without a positive deal value, so the UI never shows a fabricated payback number.
 */
export function breakEvenCloses(
  monthlyUsd: number,
  dealValueUsd: number,
  interval: BillingInterval
): number | null {
  if (dealValueUsd <= 0) return null;
  const annualCost = interval === "year" ? annualYearlyUsd(monthlyUsd) : monthlyUsd * 12;
  return Math.ceil(annualCost / dealValueUsd);
}

/** Quantity add-ons available on every plan (priced Stripe-side, billed per unit). */
export const ADDON_DISPLAY = [
  {
    key: "seat" as const,
    label: "Extra team seat",
    blurb: "Add a teammate beyond your plan's included seats.",
  },
  {
    key: "linkedinAccount" as const,
    label: "Extra LinkedIn sender",
    blurb: "Add another connected LinkedIn account — outreach spreads across all your senders.",
  },
];

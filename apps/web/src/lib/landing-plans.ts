import {
  PLAN_DISPLAY,
  PLAN_DISPLAY_ORDER,
  annualMonthlyUsd,
  annualYearlyUsd,
} from "@vantera/billing";
import type { LandingPlan } from "@/components/landing/pricing";

/**
 * The plans the marketing pages show, read from the billing source of truth
 * (@vantera/billing) — never hardcoded marketing prices. Server-only: the billing
 * package pulls in the Stripe SDK, so client components receive these as props.
 */
export function getLandingPlans(): LandingPlan[] {
  return PLAN_DISPLAY_ORDER.map((tier) => {
    const d = PLAN_DISPLAY[tier];
    return {
      tier: d.tier,
      name: d.name,
      tagline: d.tagline,
      monthlyUsd: d.monthlyUsd,
      annualMonthlyUsd: annualMonthlyUsd(d.monthlyUsd),
      annualYearlyUsd: annualYearlyUsd(d.monthlyUsd),
      highlight: d.highlight,
      features: d.features,
    };
  });
}

/** The plan the page steers toward: billing's highlighted plan, else the first. */
export function headlinePlan(plans: LandingPlan[]): LandingPlan | undefined {
  return plans.find((p) => p.highlight) ?? plans[0];
}

import {
  PLAN_DISPLAY,
  PLAN_DISPLAY_ORDER,
  annualMonthlyUsd,
  annualYearlyUsd,
} from "@vantera/billing";
import type { OnboardingPrefill } from "@/lib/auth/onboarding-context";
import type { OnboardingPlan } from "@/app/onboarding/subscription-step";

/**
 * Sample data for /onboarding-preview. The favicon is set so the details form doesn't
 * look the site up on mount — the preview renders with no network call.
 */
export const PREVIEW_PREFILL: OnboardingPrefill = {
  fullName: "Anna Kowalski",
  brandName: "Northwind",
  websiteUrl: "northwind.io",
  faviconUrl: "/favicon.ico",
  email: "anna@northwind.io",
};

/** The plans the real step shows, built from the billing display data the same way. */
export function previewPlans(): OnboardingPlan[] {
  return PLAN_DISPLAY_ORDER.map((tier) => {
    const d = PLAN_DISPLAY[tier];
    return {
      tier,
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

/** The states each step can be viewed in (?state=), beside its default. */
export const PREVIEW_STATES: Record<1 | 2 | 3, string[]> = {
  1: [],
  2: ["failed", "unconfirmed"],
  3: ["confirming", "canceled", "error", "failed", "bypass"],
};

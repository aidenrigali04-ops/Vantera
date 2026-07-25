import type { Metadata } from "next";
import {
  PLAN_DISPLAY,
  PLAN_DISPLAY_ORDER,
  ADDON_DISPLAY,
  annualMonthlyUsd,
  annualYearlyUsd,
} from "@vantera/billing";
import { LandingNav } from "@/components/landing/nav";
import { LandingFooter } from "@/components/landing/footer";
import type { PlanCard } from "@/components/pricing/pricing-grid";
import { MarketingPricing } from "./marketing-pricing";

export const metadata: Metadata = {
  title: "Pricing — Vantera",
  description:
    "Self-optimizing agents that find in-market buyers, qualify them, and reach out on LinkedIn — you approve every send.",
  alternates: { canonical: "/pricing" },
};

export default function PricingPage() {
  const plans: PlanCard[] = PLAN_DISPLAY_ORDER.map((tier) => {
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

  return (
    // `.landing` scopes the 2026 premium light system (white + cyan + Poppins) so this
    // standalone pricing page matches the marketing landing exactly (globals.css).
    <div className="landing relative min-h-screen w-full overflow-x-clip">
      <LandingNav />
      <main className="mx-auto w-full max-w-6xl px-6 pb-24 pt-28 sm:pt-32">
        <MarketingPricing
          plans={plans}
          addons={ADDON_DISPLAY.map((a) => ({ key: a.key, label: a.label, blurb: a.blurb }))}
        />
      </main>
      <LandingFooter />
    </div>
  );
}

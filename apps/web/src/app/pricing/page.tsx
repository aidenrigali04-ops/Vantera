import type { Metadata } from "next";
import Link from "next/link";
import {
  PLAN_DISPLAY,
  PLAN_DISPLAY_ORDER,
  ADDON_DISPLAY,
  annualMonthlyUsd,
  annualYearlyUsd,
} from "@vantera/billing";
import { DottedSurface } from "@/components/ui/dotted-surface";
import { GlassFilter } from "@/components/ui/liquid-glass";
import { Button } from "@/components/ui/button";
import type { PlanCard } from "@/components/pricing/pricing-grid";
import { MarketingPricing } from "./marketing-pricing";

export const metadata: Metadata = {
  title: "Pricing — Vantera",
  description: "Autonomous agents that find in-market buyers, qualify them, and reach out on LinkedIn — you approve every send.",
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
    // Forced dark + a fixed backdrop behind the particle canvas (rule 07): the
    // wrapper stays transparent so the dots show through the translucent panels.
    <main className="dark relative flex min-h-screen flex-col items-center px-6 py-16">
      <div aria-hidden className="fixed inset-0 -z-10 bg-background" />
      <DottedSurface colorTheme="dark" />
      <GlassFilter />

      <div className="flex w-full max-w-6xl flex-col gap-14">
        <nav className="flex items-center justify-between">
          <Link href="/" className="font-heading text-base font-semibold tracking-tight">
            Vantera
          </Link>
          <Button asChild variant="ghost" size="sm">
            <Link href="/login">Sign in</Link>
          </Button>
        </nav>

        <MarketingPricing
          plans={plans}
          addons={ADDON_DISPLAY.map((a) => ({ key: a.key, label: a.label, blurb: a.blurb }))}
        />
      </div>
    </main>
  );
}

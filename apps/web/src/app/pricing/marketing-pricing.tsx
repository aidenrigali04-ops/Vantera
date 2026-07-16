"use client";

import { Button } from "@/components/ui/button";
import { PricingGrid, type PlanCard, type AddonCard } from "@/components/pricing/pricing-grid";

/**
 * Public, unauthenticated pricing. CTAs lead to free signup — plan and cadence are
 * chosen later at the first-deploy checkout, so the marketing card doesn't bill here.
 */
export function MarketingPricing({
  plans,
  addons,
}: {
  plans: PlanCard[];
  addons: AddonCard[];
}) {
  return (
    <PricingGrid
      plans={plans}
      addons={addons}
      title="Pricing built around your revenue goal"
      subtitle="Autonomous agents that find in-market buyers, qualify them, and reach out on LinkedIn. Free 7-day trial, no card — and the clock only starts when you connect LinkedIn."
      renderCta={({ plan }) => (
        <Button
          asChild
          variant={plan.highlight ? "default" : "outline"}
          size="lg"
          className="w-full"
        >
          <a href="/signup">Start free</a>
        </Button>
      )}
    />
  );
}

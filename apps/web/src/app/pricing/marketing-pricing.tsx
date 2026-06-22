"use client";

import { Button } from "@/components/ui/button";
import { PricingGrid, type PlanCard, type AddonCard } from "@/components/pricing/pricing-grid";

const SALES_EMAIL = "sales@vanterasystem.com";

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
      subtitle="Autonomous agents that find in-market buyers, qualify them, and reach out on LinkedIn. Start free — choose a plan when you deploy your first agent."
      enterpriseCta={
        <Button asChild variant="outline" size="sm">
          <a href={`mailto:${SALES_EMAIL}`}>Talk to us</a>
        </Button>
      }
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

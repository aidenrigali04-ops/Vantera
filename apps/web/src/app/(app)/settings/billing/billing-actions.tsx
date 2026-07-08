"use client";

import { Button } from "@/components/ui/button";
import type { PlanTier } from "@vantera/billing";
import { startCheckout, openBillingPortal } from "./actions";
import { trackEvent } from "@/lib/analytics/clarity";

export function CheckoutButtons({ tiers }: { tiers: PlanTier[] }) {
  return (
    <div className="flex gap-2">
      {tiers.map((tier) => (
        <form
          key={tier}
          action={startCheckout}
          onSubmit={() => trackEvent("checkout_started", { plan: tier })}
        >
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

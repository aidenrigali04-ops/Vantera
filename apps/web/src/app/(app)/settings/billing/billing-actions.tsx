"use client";

import { Button } from "@/components/ui/button";
import { openBillingPortal } from "./actions";

/** Opens the Stripe portal — plan changes, payment method, invoices & receipts. */
export function ManageBillingButton({ label = "Manage billing" }: { label?: string }) {
  return (
    <form action={openBillingPortal}>
      <Button type="submit" variant="outline" size="sm">{label}</Button>
    </form>
  );
}

import {
  resolveEntitlements,
  checkLimit,
  isActive,
  type EntitlementSnapshot,
  type GatedResource,
} from "@vantera/billing";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Valid, Invalid } from "@/lib/validation";

export interface AccountBillingRow {
  plan: string;
  subscription_status: string;
  seats_purchased: number;
  linkedin_accounts_purchased: number;
  current_period_end: string | null;
}

export function snapshotFromRow(row: AccountBillingRow): EntitlementSnapshot {
  return {
    plan: row.plan as EntitlementSnapshot["plan"],
    subscriptionStatus: row.subscription_status as EntitlementSnapshot["subscriptionStatus"],
    seatsPurchased: row.seats_purchased,
    linkedinAccountsPurchased: row.linkedin_accounts_purchased,
    currentPeriodEnd: row.current_period_end,
  };
}

/**
 * True when the account can deploy/run agents — a paid plan OR an active trial.
 * The first-deploy gate uses this so trial users still reach the aha moment, while
 * no-plan and lapsed accounts are routed to choose a plan. Null row (no account
 * billing data yet) counts as no plan.
 */
export function hasActivePlan(row: AccountBillingRow | null): boolean {
  if (!row) return false;
  const snap = snapshotFromRow(row);
  return snap.plan !== "none" && isActive(snap.subscriptionStatus);
}

/** Pure gate: returns the validation-style result the actions already use. */
export function gate(
  row: AccountBillingRow,
  resource: GatedResource,
  currentCount: number
): Valid<true> | Invalid {
  const limits = resolveEntitlements(snapshotFromRow(row));
  const res = checkLimit(resource, currentCount, limits);
  return res.allowed
    ? { ok: true, values: true }
    : { ok: false, error: res.reason ?? "Plan limit reached." };
}

const BILLING_COLS =
  "plan, subscription_status, seats_purchased, linkedin_accounts_purchased, current_period_end";

/** Server-side: load the account billing row via the RLS-scoped session client. */
export async function loadBillingRow(
  supabase: SupabaseClient
): Promise<AccountBillingRow | null> {
  const { data } = await supabase
    .from("accounts")
    .select(`id, ${BILLING_COLS}`)
    .limit(1)
    .maybeSingle();
  return data ?? null;
}

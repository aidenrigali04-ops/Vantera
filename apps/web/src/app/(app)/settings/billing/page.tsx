import { getGateData } from "@/lib/auth/context";
import { createClient } from "@/lib/supabase/server";
import { cn } from "@/lib/utils";
import { PANEL_SURFACE } from "@/components/ui/panel";
import { Card, CardAction, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  resolveEntitlements,
  isActive,
  trialDaysLeft,
  PLAN_DISPLAY,
  PLAN_DISPLAY_ORDER,
  ADDON_DISPLAY,
  annualMonthlyUsd,
  annualYearlyUsd,
  type PlanTier,
} from "@vantera/billing";
import { snapshotFromRow, type AccountBillingRow } from "@/lib/billing/entitlement";
import { ManageBillingButton } from "./billing-actions";
import { PricingPlans, type PlanCard } from "./pricing-plans";

// Human labels for raw Stripe subscription statuses — never show `past_due` to a user.
const STATUS_LABELS: Record<string, string> = {
  active: "Active",
  trialing: "Trial",
  past_due: "Past due",
  canceled: "Canceled",
  incomplete: "Incomplete",
};

export default async function BillingPage({
  searchParams,
}: {
  searchParams: Promise<{ reason?: string; portal?: string }>;
}) {
  const { reason, portal } = await searchParams;
  const { account } = await getGateData();
  if (!account) return null;

  const supabase = await createClient();
  const { data: row } = await supabase
    .from("accounts")
    .select("plan, subscription_status, seats_purchased, linkedin_accounts_purchased, current_period_end, trial_ends_at")
    .limit(1)
    .maybeSingle<AccountBillingRow & { trial_ends_at: string | null }>();

  const snap = row ? snapshotFromRow(row) : null;
  const limits = snap ? resolveEntitlements(snap) : null;

  // Entitlement (trial or paid) = the gate passes. Paid subscription = there's a
  // Stripe sub to manage/switch via the portal; a trial has neither, so trial users
  // see checkout CTAs on every tier.
  const hasEntitlement = !!snap && snap.plan !== "none" && isActive(snap.subscriptionStatus);
  const isTrialing = snap?.subscriptionStatus === "trialing";
  const hasPaidSubscription =
    !!snap && ["active", "past_due"].includes(snap.subscriptionStatus);
  const daysLeft = isTrialing ? trialDaysLeft(row?.trial_ends_at ?? null) : null;
  const currentTier: PlanTier | "none" =
    hasPaidSubscription && snap ? snap.plan : "none";

  const [{ count: seatCount }, { count: campaignCount }, { count: liCount }] = await Promise.all([
    supabase.from("account_members").select("user_id", { count: "exact", head: true }),
    supabase.from("campaigns").select("id", { count: "exact", head: true }),
    supabase.from("linkedin_accounts").select("id", { count: "exact", head: true }),
  ]);

  const lapsed = snap ? ["past_due", "canceled"].includes(snap.subscriptionStatus) : false;

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
    <div className="mx-auto flex max-w-6xl flex-col gap-10">
      {portal === "unavailable" && (
        <div className={cn(PANEL_SURFACE, "p-5 text-sm")}>
          <span className="font-heading font-semibold">The billing portal isn&apos;t available yet.</span>{" "}
          <span className="text-muted-foreground">
            It opens after your first payment — choose a plan below to get started.
          </span>
        </div>
      )}

      {reason === "deploy" && !hasEntitlement && (
        <div className={cn(PANEL_SURFACE, "p-5 text-sm")}>
          <span className="font-heading font-semibold">Choose a plan to deploy your agent.</span>{" "}
          <span className="text-muted-foreground">
            Your agents go live the moment a plan is active — pick the one that fits your team and how much you want to run.
          </span>
        </div>
      )}

      {isTrialing && limits && (
        <div className={cn(PANEL_SURFACE, "flex flex-col gap-4 p-5")}>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="text-sm">
              <span className="font-heading font-semibold">
                {daysLeft === 0
                  ? "Your free trial ends today."
                  : `Your free trial ends in ${daysLeft} day${daysLeft === 1 ? "" : "s"}.`}
              </span>{" "}
              <span className="text-muted-foreground">
                Choose a plan below to keep your agents running — your leads, agents, and history stay exactly as they are.
              </span>
            </p>
            <Badge variant="secondary" className="font-mono uppercase tracking-[0.14em]">
              Trial · {daysLeft}d left
            </Badge>
          </div>
          <ul className="text-sm text-muted-foreground">
            <li>Seats: {seatCount ?? 0} / {limits.maxSeats}</li>
            <li>LinkedIn accounts: {liCount ?? 0} / {limits.maxLinkedinAccounts}</li>
            <li>Outreach agents: {campaignCount ?? 0} / {limits.maxCampaigns}</li>
          </ul>
        </div>
      )}

      {lapsed && (
        <Card className="border-destructive">
          <CardContent className="pt-6 text-sm">
            Your subscription needs attention — new outreach is paused until it&apos;s active again.
          </CardContent>
        </Card>
      )}

      {hasPaidSubscription && limits && (
        <Card className="max-w-2xl">
          <CardHeader>
            <CardTitle>Current plan</CardTitle>
            <CardAction>
              <Badge variant={snap?.subscriptionStatus === "active" ? "default" : "secondary"}>
                {`${(currentTier !== "none" && PLAN_DISPLAY[currentTier]?.name) || snap?.plan} · ${STATUS_LABELS[snap?.subscriptionStatus ?? ""] ?? snap?.subscriptionStatus}`}
              </Badge>
            </CardAction>
          </CardHeader>
          <CardContent className="flex flex-col gap-4">
            <ul className="text-sm text-muted-foreground">
              <li>Seats: {seatCount ?? 0} / {limits.maxSeats}</li>
              <li>LinkedIn accounts: {liCount ?? 0} / {limits.maxLinkedinAccounts}</li>
              <li>Outreach agents: {campaignCount ?? 0} / {limits.maxCampaigns}</li>
            </ul>
            <ManageBillingButton />
          </CardContent>
        </Card>
      )}

      <PricingPlans
        plans={plans}
        addons={ADDON_DISPLAY.map((a) => ({ key: a.key, label: a.label, blurb: a.blurb }))}
        currentTier={currentTier}
        hasActivePlan={hasPaidSubscription}
        dealValueUsd={account.avg_deal_value_cents ? account.avg_deal_value_cents / 100 : null}
      />
    </div>
  );
}

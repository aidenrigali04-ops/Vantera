import { getGateData } from "@/lib/auth/context";
import { createClient } from "@/lib/supabase/server";
import { cn } from "@/lib/utils";
import { PANEL_SURFACE } from "@/components/ui/panel";
import { Card, CardAction, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  resolveEntitlements,
  isActive,
  PLAN_DISPLAY,
  PLAN_DISPLAY_ORDER,
  ADDON_DISPLAY,
  type PlanTier,
} from "@vantera/billing";
import { snapshotFromRow, type AccountBillingRow } from "@/lib/billing/entitlement";
import { ManageBillingButton } from "./billing-actions";
import { PricingPlans, type PlanCard } from "./pricing-plans";

export default async function BillingPage({
  searchParams,
}: {
  searchParams: Promise<{ reason?: string }>;
}) {
  const { reason } = await searchParams;
  const { account } = await getGateData();
  if (!account) return null;

  const supabase = await createClient();
  const { data: row } = await supabase
    .from("accounts")
    .select("plan, subscription_status, seats_purchased, linkedin_accounts_purchased, current_period_end")
    .limit(1)
    .maybeSingle<AccountBillingRow>();

  const snap = row ? snapshotFromRow(row) : null;
  const limits = snap ? resolveEntitlements(snap) : null;
  const hasActivePlan =
    !!snap && snap.plan !== "none" && isActive(snap.subscriptionStatus);
  const currentTier: PlanTier | "none" = snap && snap.plan !== "none" ? snap.plan : "none";

  const [{ count: seatCount }, { count: mailboxCount }, { count: campaignCount }, { count: liCount }] =
    await Promise.all([
      supabase.from("account_members").select("user_id", { count: "exact", head: true }),
      supabase.from("mailboxes").select("id", { count: "exact", head: true }),
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
      highlight: d.highlight,
      features: d.features,
    };
  });

  return (
    <div className="flex max-w-6xl flex-col gap-10">
      {reason === "deploy" && !hasActivePlan && (
        <div className={cn(PANEL_SURFACE, "p-5 text-sm")}>
          <span className="font-heading font-semibold">Choose a plan to deploy your agent.</span>{" "}
          <span className="text-muted-foreground">
            Your agents go live the moment a plan is active — pick the one that fits the channels you want to run.
          </span>
        </div>
      )}

      {lapsed && (
        <Card className="border-destructive">
          <CardContent className="pt-6 text-sm">
            Your subscription needs attention — new outreach is paused until it&apos;s active again.
          </CardContent>
        </Card>
      )}

      {hasActivePlan && limits && (
        <Card className="max-w-2xl">
          <CardHeader>
            <CardTitle>Current plan</CardTitle>
            <CardAction>
              <Badge variant={snap?.subscriptionStatus === "active" ? "default" : "secondary"}>
                {`${snap?.plan} · ${snap?.subscriptionStatus}`}
              </Badge>
            </CardAction>
          </CardHeader>
          <CardContent className="flex flex-col gap-4">
            <ul className="text-sm text-muted-foreground">
              <li>Seats: {seatCount ?? 0} / {limits.maxSeats}</li>
              <li>LinkedIn accounts: {liCount ?? 0} / {limits.maxLinkedinAccounts}</li>
              <li>Mailboxes: {mailboxCount ?? 0} / {limits.maxMailboxes}</li>
              <li>Campaigns: {campaignCount ?? 0} / {limits.maxCampaigns}</li>
            </ul>
            <ManageBillingButton />
          </CardContent>
        </Card>
      )}

      <PricingPlans
        plans={plans}
        addons={ADDON_DISPLAY.map((a) => ({ key: a.key, label: a.label, blurb: a.blurb }))}
        currentTier={currentTier}
        hasActivePlan={hasActivePlan}
      />
    </div>
  );
}

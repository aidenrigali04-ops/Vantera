import { getGateData } from "@/lib/auth/context";
import { createClient } from "@/lib/supabase/server";
import { Card, CardAction, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { resolveEntitlements, PLANS, type PlanTier } from "@vantera/billing";
import { snapshotFromRow, type AccountBillingRow } from "@/lib/billing/entitlement";
import { CheckoutButtons, ManageBillingButton } from "./billing-actions";

export default async function BillingPage() {
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

  const [{ count: seatCount }, { count: mailboxCount }, { count: campaignCount }, { count: liCount }] =
    await Promise.all([
      supabase.from("account_members").select("user_id", { count: "exact", head: true }),
      supabase.from("mailboxes").select("id", { count: "exact", head: true }),
      supabase.from("campaigns").select("id", { count: "exact", head: true }),
      supabase.from("linkedin_accounts").select("id", { count: "exact", head: true }),
    ]);

  const lapsed = snap ? ["past_due", "canceled"].includes(snap.subscriptionStatus) : false;

  return (
    <div className="flex max-w-2xl flex-col gap-6">
      <h1 className="text-2xl font-semibold tracking-tight">Billing</h1>

      {lapsed && (
        <Card className="border-destructive">
          <CardContent className="pt-6 text-sm">
            Your subscription needs attention — new outreach is paused until it&apos;s active again.
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Current plan</CardTitle>
          <CardAction>
            <Badge variant={snap?.subscriptionStatus === "active" ? "default" : "secondary"}>
              {!snap || snap.plan === "none" ? "No plan" : `${snap.plan} · ${snap.subscriptionStatus}`}
            </Badge>
          </CardAction>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          {limits ? (
            <ul className="text-sm text-muted-foreground">
              <li>Seats: {seatCount ?? 0} / {limits.maxSeats}</li>
              <li>LinkedIn accounts: {liCount ?? 0} / {limits.maxLinkedinAccounts}</li>
              <li>Mailboxes: {mailboxCount ?? 0} / {limits.maxMailboxes}</li>
              <li>Campaigns: {campaignCount ?? 0} / {limits.maxCampaigns}</li>
            </ul>
          ) : null}
          {!snap || snap.plan === "none" ? (
            <CheckoutButtons tiers={Object.keys(PLANS) as PlanTier[]} />
          ) : (
            <ManageBillingButton />
          )}
        </CardContent>
      </Card>
    </div>
  );
}

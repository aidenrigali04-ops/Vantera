import { createClient } from "@/lib/supabase/server";
import { getGateData } from "@/lib/auth/context";
import { PLAN_DISPLAY } from "@vantera/billing";
import { computeFunnel, computeRevenueSnapshot, computeRoi } from "@/lib/revenue";
import { AnalyticsView } from "./analytics-view";

// WS-A — the renewal surface. Turns RLS-scoped lead counts + the account's plan price into the
// conversion funnel and the ROI the report says decides renewal (pipeline vs the 2x-spend bar).
// Spend is the plan price (what the customer pays Vantera), never COGS. No placeholder numbers:
// dollar/ratio figures are gated behind a set deal value + an active plan in the view.
export default async function AnalyticsPage() {
  const { account } = await getGateData();
  if (!account) return null; // layout gate guarantees this; satisfies TS

  const supabase = await createClient();

  // RLS scopes every query to this account (rule 02) — no account id is passed.
  const countByStatus = (statuses: string[]) =>
    supabase.from("leads").select("id", { count: "exact", head: true }).in("status", statuses);

  const [
    qualifiedEnrichedRes,
    inCampaignRes,
    repliedOnlyRes,
    convertedRes,
    meetingsRes,
    planRes,
  ] = await Promise.all([
    countByStatus(["qualified", "enriched"]),
    countByStatus(["in_campaign"]),
    countByStatus(["replied"]),
    countByStatus(["converted"]),
    // meeting-booked stage (0028) — server-set; 0 until the writer lands.
    supabase.from("leads").select("id", { count: "exact", head: true }).not("meeting_booked_at", "is", null),
    supabase.from("accounts").select("plan").eq("id", account.id).maybeSingle(),
  ]);

  const qualifiedEnriched = qualifiedEnrichedRes.count ?? 0;
  const inCampaign = inCampaignRes.count ?? 0;
  const repliedOnly = repliedOnlyRes.count ?? 0;
  const converted = convertedRes.count ?? 0;
  const meetings = meetingsRes.count ?? 0;

  // Cumulative funnel: each stage ⊇ the next (monotonic), so it reads as a real funnel.
  const funnel = computeFunnel({
    qualified: qualifiedEnriched + inCampaign + repliedOnly + converted,
    contacted: inCampaign + repliedOnly + converted,
    replied: repliedOnly + converted,
    meetings,
    closed: converted,
  });

  // Snapshot reuses the non-cumulative buckets (same weighting the dashboard uses).
  const snapshot = computeRevenueSnapshot({
    convertedClients: converted,
    pipeline: { qualified: qualifiedEnriched, inOutreach: inCampaign, replied: repliedOnly },
    avgDealValueCents: account.avg_deal_value_cents,
    goalCents: account.revenue_goal_cents,
  });

  const plan = (planRes.data?.plan ?? "none") as "none" | "starter" | "growth" | "scale";
  const planMonthlyCents = plan === "none" ? null : PLAN_DISPLAY[plan].monthlyUsd * 100;

  const roi = computeRoi({
    closedCents: snapshot.closedCents,
    pipelineCents: snapshot.expectedCents,
    planMonthlyCents,
    meetings,
    closes: converted,
  });

  return (
    <AnalyticsView
      hasLeads={funnel[0]!.count > 0}
      funnel={funnel}
      meetingsTracked={meetings > 0}
      roi={roi}
      hasValue={snapshot.hasValue}
      closedCents={snapshot.closedCents}
      pipelineCents={snapshot.expectedCents}
      goalCents={snapshot.goalCents}
    />
  );
}

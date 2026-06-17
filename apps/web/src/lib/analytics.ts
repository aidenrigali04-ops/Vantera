import type { SupabaseClient } from "@supabase/supabase-js";
import { PLAN_DISPLAY } from "@vantera/billing";
import {
  computeFunnel,
  computeRevenueSnapshot,
  computeRoi,
  type FunnelStage,
  type Roi,
} from "./revenue";

// Single source for the /analytics surface AND the copilot's return-on-spend tool, so the
// number the copilot quotes is always the number the page shows. RLS scopes every query to
// the caller's account (rule 02) — no accountId is passed.

export type AnalyticsViewModel = {
  hasLeads: boolean;
  funnel: FunnelStage[];
  /** false until the meeting_booked_at writer lands → the Meetings stage shows an honest hint */
  meetingsTracked: boolean;
  roi: Roi;
  /** avg deal value is set (>0) — dollar/ratio figures gate behind this */
  hasValue: boolean;
  closedCents: number;
  pipelineCents: number;
  goalCents: number | null;
};

export async function loadAnalytics(db: SupabaseClient): Promise<AnalyticsViewModel> {
  const countByStatus = (statuses: string[]) =>
    db.from("leads").select("id", { count: "exact", head: true }).in("status", statuses);

  const [qualifiedEnrichedRes, inCampaignRes, repliedOnlyRes, convertedRes, meetingsRes, accountRes] =
    await Promise.all([
      countByStatus(["qualified", "enriched"]),
      countByStatus(["in_campaign"]),
      countByStatus(["replied"]),
      countByStatus(["converted"]),
      db.from("leads").select("id", { count: "exact", head: true }).not("meeting_booked_at", "is", null),
      db.from("accounts").select("avg_deal_value_cents, revenue_goal_cents, plan").limit(1).maybeSingle(),
    ]);

  const qualifiedEnriched = qualifiedEnrichedRes.count ?? 0;
  const inCampaign = inCampaignRes.count ?? 0;
  const repliedOnly = repliedOnlyRes.count ?? 0;
  const converted = convertedRes.count ?? 0;
  const meetings = meetingsRes.count ?? 0;

  const avgDealValueCents = accountRes.data?.avg_deal_value_cents ?? null;
  const goalCents = accountRes.data?.revenue_goal_cents ?? null;
  const plan = (accountRes.data?.plan ?? "none") as "none" | "starter" | "growth" | "scale";
  const planMonthlyCents = plan === "none" ? null : PLAN_DISPLAY[plan].monthlyUsd * 100;

  // Cumulative funnel: each stage ⊇ the next (monotonic).
  const funnel = computeFunnel({
    qualified: qualifiedEnriched + inCampaign + repliedOnly + converted,
    contacted: inCampaign + repliedOnly + converted,
    replied: repliedOnly + converted,
    meetings,
    closed: converted,
  });

  // Non-cumulative buckets for the stage-weighted snapshot (same weighting the dashboard uses).
  const snapshot = computeRevenueSnapshot({
    convertedClients: converted,
    pipeline: { qualified: qualifiedEnriched, inOutreach: inCampaign, replied: repliedOnly },
    avgDealValueCents,
    goalCents,
  });

  const roi = computeRoi({
    closedCents: snapshot.closedCents,
    pipelineCents: snapshot.expectedCents,
    planMonthlyCents,
    meetings,
    closes: converted,
  });

  return {
    hasLeads: funnel[0]!.count > 0,
    funnel,
    meetingsTracked: meetings > 0,
    roi,
    hasValue: snapshot.hasValue,
    closedCents: snapshot.closedCents,
    pipelineCents: snapshot.expectedCents,
    goalCents: snapshot.goalCents,
  };
}

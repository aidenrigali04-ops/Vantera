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

// ── Signal → revenue attribution (0031) ──────────────────────────────────────
// The dependency mechanism: trace closed wins back to the buying signal that opened the door, so the
// user sees the real signals on Leads (Surface A) literally producing the revenue on Results
// (Surface B). Closed-won leads only — a win is real money, never a projection.

const SIGNAL_KIND_LABELS: Record<string, string> = {
  funding: "Funding rounds",
  exec_hire: "Exec hires",
  m_and_a: "M&A",
  office_opening: "Office openings",
  office_closing: "Office closings",
  product_launch: "Product launches",
  partnership: "Partnerships",
  award: "Awards",
  hiring: "Hiring",
  workforce: "Workforce shifts",
  cost_cutting: "Cost-cutting",
  legal: "Legal proceedings",
  security: "Security incidents",
  intent: "Buying intent",
  other: "Other signals",
};

export function signalKindLabel(kind: string): string {
  return SIGNAL_KIND_LABELS[kind] ?? kind;
}

export type SignalAttribution = { kind: string; label: string; wins: number };

/**
 * Count closed wins by the signal kinds that preceded them. A win counts once per DISTINCT kind it
 * carried (a lead with two funding signals isn't two funding wins). Pure + deterministic so it's
 * unit-tested without a DB. Sorted by wins desc, then kind for stability.
 */
export function aggregateSignalAttribution(
  wins: { lead_signals?: { kind: string }[] | null }[]
): SignalAttribution[] {
  const counts = new Map<string, number>();
  for (const w of wins) {
    const kinds = new Set((w.lead_signals ?? []).map((s) => s.kind));
    for (const k of kinds) counts.set(k, (counts.get(k) ?? 0) + 1);
  }
  return [...counts.entries()]
    .map(([kind, n]) => ({ kind, label: signalKindLabel(kind), wins: n }))
    .sort((a, b) => b.wins - a.wins || a.kind.localeCompare(b.kind));
}

/** Closed-won leads joined to their captured signals → wins-by-signal-kind. RLS-scoped (rule 02). */
export async function loadSignalAttribution(db: SupabaseClient): Promise<SignalAttribution[]> {
  const { data } = await db.from("leads").select("id, lead_signals(kind)").eq("status", "converted");
  return aggregateSignalAttribution(
    (data ?? []) as { lead_signals?: { kind: string }[] | null }[]
  );
}

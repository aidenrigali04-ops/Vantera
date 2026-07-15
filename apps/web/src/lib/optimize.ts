import type { SupabaseClient } from "@supabase/supabase-js";
import {
  computeOutreachFunnel,
  diagnoseOutreach,
  recommendForDiagnosis,
  describeStrategy,
  proposeChallengerStrategy,
  buildTargetingProfile,
  topTiltSegment,
  type OutreachDiagnosis,
  type OutreachFunnelStage,
  type OutreachRecommendation,
  type FunnelStageKey,
  type CopyStrategy,
  type TargetingRow,
} from "@vantera/agent-brains";

// Phase 1 of the self-optimizing loop (docs/superpowers/specs/2026-06-29-self-optimizing-outreach-
// design.md): the read-only "where your outreach leaks" measurement. RLS scopes every query to the
// caller's account (rule 02) — no accountId is passed. Pure math lives in @vantera/agent-brains;
// this file only fetches counts and hands them over.

export type OutreachDiagnosisVM = {
  funnel: OutreachFunnelStage[];
  diagnosis: OutreachDiagnosis;
  /** the one suggested change for the diagnosed leak (Phase 2); null when nothing to act on */
  recommendation: OutreachRecommendation | null;
  /** any invite has been sent — gates the whole panel */
  hasOutreach: boolean;
  /** the account's live experiment (Phase 3), running or awaiting the owner's adopt decision */
  experiment: {
    id: string;
    status: "running" | "ready_to_adopt";
    challengerLabel: string;
    decisionReason: string | null;
  } | null;
  /** an offer to auto-test a copy change for the diagnosed leak — only when nothing is running */
  experimentOffer: { stageKey: FunnelStageKey; label: string } | null;
  /** the most recent autonomous adoption (Stage 0) — what Vera changed and why, revertable */
  lastAdoption: {
    experimentId: string;
    label: string;
    reason: string | null;
    concludedAt: string | null;
    /** real message-level receipts (Stage 1): sends stamped with the CURRENT playbook version.
     *  null until at least one stamped send exists — numbers are never invented. */
    receipts: { sent: number; interested: number } | null;
  } | null;
  /** Stage 2: the buyer segment Vera is prioritizing, with the real numbers behind it.
   *  Null until a segment passes the sample floor — never an invented focus. */
  targetingFocus: {
    label: string;
    deep: number;
    n: number;
    baselineDeep: number;
    baselineN: number;
  } | null;
};

/** Distinct stamped leads with an interested reply after the adoption moment (Stage 1 receipts). Pure. */
export function countInterestedSince(
  stampedLeadIds: Set<string>,
  interested: { lead_id: string; received_at: string }[],
  concludedAt: string | null
): number {
  const cutoff = concludedAt ? new Date(concludedAt).getTime() : null;
  const winners = new Set<string>();
  for (const r of interested) {
    if (!stampedLeadIds.has(r.lead_id)) continue;
    if (cutoff !== null && new Date(r.received_at).getTime() <= cutoff) continue;
    winners.add(r.lead_id);
  }
  return winners.size;
}

export async function loadOutreachDiagnosis(db: SupabaseClient): Promise<OutreachDiagnosisVM> {
  const notNull = (col: string) =>
    db.from("leads").select("id", { count: "exact", head: true }).not(col, "is", null);

  const [invitedRes, acceptedRes, bookedRes, convertedRes, interestedRes] = await Promise.all([
    notNull("linkedin_invited_at"),
    notNull("linkedin_connected_at"),
    notNull("meeting_booked_at"),
    db.from("leads").select("id", { count: "exact", head: true }).eq("status", "converted"),
    db.from("replies").select("lead_id, received_at").eq("classification", "interested"),
  ]);

  const invited = invitedRes.count ?? 0;
  const accepted = acceptedRes.count ?? 0;
  const booked = bookedRes.count ?? 0;
  const closed = convertedRes.count ?? 0;
  // Distinct leads with an interested reply (a lead can reply more than once).
  const interestedReplies = new Set(
    ((interestedRes.data ?? []) as { lead_id: string }[]).map((r) => r.lead_id)
  ).size;

  const funnel = computeOutreachFunnel({ invited, accepted, interestedReplies, booked, closed });
  const diagnosis = diagnoseOutreach(funnel);

  // The account's live experiment (running or awaiting the owner's adopt decision), if any.
  const { data: expRow } = await db
    .from("optimization_experiments")
    .select("id, status, challenger_strategy, decision_reason")
    .in("status", ["running", "ready_to_adopt"])
    .order("started_at", { ascending: false })
    .limit(1)
    .maybeSingle<{
      id: string;
      status: "running" | "ready_to_adopt";
      challenger_strategy: CopyStrategy;
      decision_reason: string | null;
    }>();
  const experiment = expRow
    ? {
        id: expRow.id,
        status: expRow.status,
        challengerLabel: describeStrategy(expRow.challenger_strategy ?? {}),
        decisionReason: expRow.decision_reason,
      }
    : null;

  // Offer to auto-test only when there's a copy-controllable leak and nothing is already running.
  let experimentOffer: OutreachDiagnosisVM["experimentOffer"] = null;
  if (!experiment && diagnosis.status === "leak" && diagnosis.stageKey) {
    const challenger = proposeChallengerStrategy(diagnosis.stageKey);
    if (challenger) experimentOffer = { stageKey: diagnosis.stageKey, label: describeStrategy(challenger) };
  }

  // The most recent autonomous adoption (Stage 0) — shown with a Revert control. Reverted
  // adoptions are filtered by the "· reverted" marker revertAdoption appends to the reason.
  const { data: adoptedRow } = await db
    .from("optimization_experiments")
    .select("id, challenger_strategy, decision_reason, concluded_at")
    .eq("status", "adopted")
    .order("concluded_at", { ascending: false })
    .limit(1)
    .maybeSingle<{
      id: string;
      challenger_strategy: CopyStrategy;
      decision_reason: string | null;
      concluded_at: string | null;
    }>();
  // Stage 1 receipts: real counts of sends stamped with the CURRENT playbook version, plus
  // distinct leads among them that replied interested after the adoption. Null (no line shown)
  // until at least one stamped send exists — the panel never shows an invented number.
  let receipts: { sent: number; interested: number } | null = null;
  if (adoptedRow && !(adoptedRow.decision_reason ?? "").includes("· reverted")) {
    const { data: pb } = await db
      .from("optimization_playbook")
      .select("version")
      .maybeSingle<{ version: number }>();
    if (pb?.version) {
      const { data: stamped } = await db
        .from("scheduled_sends")
        .select("lead_id")
        .eq("status", "sent")
        .eq("recipe->>playbookVersion", String(pb.version));
      const stampedRows = (stamped ?? []) as { lead_id: string }[];
      if (stampedRows.length > 0) {
        receipts = {
          sent: stampedRows.length,
          interested: countInterestedSince(
            new Set(stampedRows.map((r) => r.lead_id)),
            (interestedRes.data ?? []) as { lead_id: string; received_at: string }[],
            adoptedRow.concluded_at
          ),
        };
      }
    }
  }

  const lastAdoption =
    adoptedRow && !(adoptedRow.decision_reason ?? "").includes("· reverted")
      ? {
          experimentId: adoptedRow.id,
          label: describeStrategy(adoptedRow.challenger_strategy ?? {}),
          reason: adoptedRow.decision_reason,
          concludedAt: adoptedRow.concluded_at,
          receipts,
        }
      : null;

  // Stage 2 targeting focus: the account's own invited-lead outcomes, bucketed by segment.
  // Rendered only when a segment passes the sample floor — the numbers are always real.
  let targetingFocus: OutreachDiagnosisVM["targetingFocus"] = null;
  if (invited > 0) {
    const { data: invitedLeads } = await db
      .from("leads")
      .select("id, title, industry, linkedin_connected_at, meeting_booked_at")
      .not("linkedin_invited_at", "is", null);
    const interestedIds = new Set(
      ((interestedRes.data ?? []) as { lead_id: string }[]).map((r) => r.lead_id)
    );
    const rows: TargetingRow[] = (
      (invitedLeads ?? []) as {
        id: string;
        title: string | null;
        industry: string | null;
        linkedin_connected_at: string | null;
        meeting_booked_at: string | null;
      }[]
    ).map((l) => ({
      title: l.title,
      industry: l.industry,
      flags: {
        invited: true,
        accepted: l.linkedin_connected_at != null,
        interested: interestedIds.has(l.id),
        negative: false,
        booked: l.meeting_booked_at != null,
        converted: false,
      },
    }));
    const top = topTiltSegment(buildTargetingProfile(rows));
    if (top) {
      targetingFocus = {
        label: top.label,
        deep: top.stat.deep,
        n: top.stat.n,
        baselineDeep: top.baseline.deep,
        baselineN: top.baseline.n,
      };
    }
  }

  return {
    funnel,
    diagnosis,
    recommendation: recommendForDiagnosis(diagnosis),
    hasOutreach: invited > 0,
    experiment,
    experimentOffer,
    lastAdoption,
    targetingFocus,
  };
}

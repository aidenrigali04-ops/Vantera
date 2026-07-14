import type { SupabaseClient } from "@supabase/supabase-js";
import {
  computeOutreachFunnel,
  diagnoseOutreach,
  recommendForDiagnosis,
  describeStrategy,
  proposeChallengerStrategy,
  type OutreachDiagnosis,
  type OutreachFunnelStage,
  type OutreachRecommendation,
  type FunnelStageKey,
  type CopyStrategy,
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
  } | null;
};

export async function loadOutreachDiagnosis(db: SupabaseClient): Promise<OutreachDiagnosisVM> {
  const notNull = (col: string) =>
    db.from("leads").select("id", { count: "exact", head: true }).not(col, "is", null);

  const [invitedRes, acceptedRes, bookedRes, convertedRes, interestedRes] = await Promise.all([
    notNull("linkedin_invited_at"),
    notNull("linkedin_connected_at"),
    notNull("meeting_booked_at"),
    db.from("leads").select("id", { count: "exact", head: true }).eq("status", "converted"),
    db.from("replies").select("lead_id").eq("classification", "interested"),
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
  const lastAdoption =
    adoptedRow && !(adoptedRow.decision_reason ?? "").includes("· reverted")
      ? {
          experimentId: adoptedRow.id,
          label: describeStrategy(adoptedRow.challenger_strategy ?? {}),
          reason: adoptedRow.decision_reason,
          concludedAt: adoptedRow.concluded_at,
        }
      : null;

  return {
    funnel,
    diagnosis,
    recommendation: recommendForDiagnosis(diagnosis),
    hasOutreach: invited > 0,
    experiment,
    experimentOffer,
    lastAdoption,
  };
}

import type { SupabaseClient } from "@supabase/supabase-js";
import {
  computeOutreachFunnel,
  diagnoseOutreach,
  recommendForDiagnosis,
  type OutreachDiagnosis,
  type OutreachFunnelStage,
  type OutreachRecommendation,
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
  return {
    funnel,
    diagnosis,
    recommendation: recommendForDiagnosis(diagnosis),
    hasOutreach: invited > 0,
  };
}

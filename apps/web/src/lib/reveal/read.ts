import "server-only";
import { createClient } from "@/lib/supabase/server";
import {
  buildRevealStatus,
  type RevealMatchRow,
  type RevealRunRow,
  type RevealStatus,
} from "./status";

/** Scored-lead window: 5 shown + replacements for rejections, comfortably inside the 15-cap pool. */
const SCORED_LEAD_LIMIT = 50;

/** Reveal poll feed for the "First prospects" step. RLS client — all four tables have member select policies. */
export async function getRevealStatus(accountId: string): Promise<RevealStatus> {
  const supabase = await createClient();

  const run = await supabase
    .from("reveal_runs")
    .select("status, scanned, gate_passed, matched, drafted, error, started_at")
    .eq("account_id", accountId)
    .maybeSingle<RevealRunRow & { started_at: string | null }>();
  if (run.error) throw new Error("reveal read failed: reveal_runs");

  let leadsQuery = supabase
    .from("leads")
    .select("id, first_name, last_name, title, company_name, ai_score, ai_rationale, ai_insights")
    .eq("account_id", accountId)
    .not("ai_score", "is", null);
  // fast-pass stamps scored_at on every score write, so this is exactly the leads scored by the
  // current run; re-found leads from an earlier pass are included once re-scored. Keeps leads
  // scored only against the old ICP (after Regenerate) out of the preview.
  if (run.data?.started_at) leadsQuery = leadsQuery.gte("scored_at", run.data.started_at);

  const [leads, drafts, feedback] = await Promise.all([
    leadsQuery.order("ai_score", { ascending: false }).limit(SCORED_LEAD_LIMIT).returns<RevealMatchRow[]>(),
    supabase
      .from("scheduled_sends")
      .select("lead_id, body")
      .eq("account_id", accountId)
      .eq("status", "pending_review")
      .eq("linkedin_stage", "invite")
      .returns<{ lead_id: string; body: string | null }[]>(),
    supabase
      .from("lead_feedback")
      .select("lead_id")
      .eq("account_id", accountId)
      .eq("verdict", "not_fit")
      .returns<{ lead_id: string }[]>(),
  ]);
  if (leads.error) throw new Error("reveal read failed: leads");
  if (drafts.error) throw new Error("reveal read failed: scheduled_sends");
  if (feedback.error) throw new Error("reveal read failed: lead_feedback");

  return buildRevealStatus(
    run.data ?? null,
    leads.data ?? [],
    drafts.data ?? [],
    new Set((feedback.data ?? []).map((f) => f.lead_id))
  );
}

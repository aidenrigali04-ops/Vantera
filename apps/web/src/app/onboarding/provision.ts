import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";

/** Default outreach CTA — sensible out of the box, refined later in Settings → Sharpen your results. */
export const DEFAULT_CTA = "a quick intro call to see if it's a fit";

const CAMPAIGN_NAME = "Outreach (agent)";

export type ProvisionDeps = {
  supabase: SupabaseClient;
  accountId: string;
  userId: string;
  icp: { id: string; name: string };
};
export type ProvisionResult = { scoutId: string; campaignId: string; copyAgentId: string };

/**
 * Provision the Scout agent (+ ICP link), the internal campaign, and the Outreach (copy) agent.
 * Idempotent: each row is reused when it already exists (agents by account+kind, the campaign
 * by name), so a retry after a partial failure only fills in what's missing. Throws on failure.
 */
export async function provisionOnboardingAgents(d: ProvisionDeps): Promise<ProvisionResult> {
  const { supabase, accountId, userId, icp } = d;

  const existingAgent = async (kind: "scout" | "copy") =>
    (
      await supabase
        .from("agents")
        .select("id")
        .eq("account_id", accountId)
        .eq("kind", kind)
        .limit(1)
        .maybeSingle<{ id: string }>()
    ).data;

  // ── Prospect (Scout) — sources + qualifies against the drafted ICP ──
  let scoutId = (await existingAgent("scout"))?.id;
  if (!scoutId) {
    const { data: scout, error } = await supabase
      .from("agents")
      .insert({
        account_id: accountId,
        kind: "scout",
        name: "Scout",
        status: "live",
        config: { prospects_per_run: 60, min_score: 70 },
        run_at_time: "08:00",
        cadence: "daily",
        timezone: "UTC",
        deployed_at: new Date().toISOString(),
        created_by: userId,
      })
      .select("id")
      .single<{ id: string }>();
    if (error || !scout) throw new Error("Could not create the Scout agent.");
    scoutId = scout.id;
    await supabase
      .from("agent_icps")
      .insert({ agent_id: scoutId, icp_id: icp.id, account_id: accountId, position: 0 });
  }

  // ── Outreach (Copy) — drafts on a default CTA into the review queue ──
  const existingCopy = await existingAgent("copy");
  if (existingCopy) {
    const { data: copyRow } = await supabase
      .from("agents")
      .select("campaign_id")
      .eq("id", existingCopy.id)
      .maybeSingle<{ campaign_id: string | null }>();
    return { scoutId, campaignId: copyRow?.campaign_id ?? "", copyAgentId: existingCopy.id };
  }

  let campaignId = (
    await supabase
      .from("campaigns")
      .select("id")
      .eq("account_id", accountId)
      .eq("name", CAMPAIGN_NAME)
      .limit(1)
      .maybeSingle<{ id: string }>()
  ).data?.id;
  if (!campaignId) {
    const { data: campaign, error } = await supabase
      .from("campaigns")
      .insert({
        account_id: accountId,
        name: CAMPAIGN_NAME,
        status: "active",
        channels: ["linkedin"],
        targeting: [{ type: "icp", value: icp.name }],
        copywriting_mode: "agent",
        send_mode: "review",
        created_by: userId,
      })
      .select("id")
      .single<{ id: string }>();
    if (error || !campaign) throw new Error("Could not create the outreach campaign.");
    campaignId = campaign.id;
  }

  const { data: copy, error: copyErr } = await supabase
    .from("agents")
    .insert({
      account_id: accountId,
      kind: "copy",
      name: "Outreach",
      status: "live",
      config: { cta: DEFAULT_CTA, channels: { linkedin: true } },
      campaign_id: campaignId,
      deployed_at: new Date().toISOString(),
      created_by: userId,
    })
    .select("id")
    .single<{ id: string }>();
  if (copyErr || !copy) throw new Error("Could not create the Outreach agent.");

  return { scoutId, campaignId, copyAgentId: copy.id };
}

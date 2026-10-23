import type { SupabaseClient } from "@supabase/supabase-js";

export type ScoutIcp = { id: string; name: string; criteria: Record<string, unknown> | null };

/**
 * The ICP the Scout actually scores against, resolved identically for the Targeting page (read)
 * and the save action (write): (a) the Scout's `agent_icps` link at position 0, else (b) the
 * account's onboarding ICP row. Null when neither exists (the save path then creates + links one).
 * Every read is pinned to the account (rule 02 defense in depth on top of RLS).
 */
export async function resolveScoutIcp(
  supabase: SupabaseClient,
  accountId: string,
  agentId: string
): Promise<ScoutIcp | null> {
  const { data: link } = await supabase
    .from("agent_icps")
    .select("icp_id")
    .eq("account_id", accountId)
    .eq("agent_id", agentId)
    .order("position", { ascending: true })
    .limit(1)
    .maybeSingle<{ icp_id: string }>();
  if (link) {
    const { data: linked } = await supabase
      .from("icps")
      .select("id, name, criteria")
      .eq("account_id", accountId)
      .eq("id", link.icp_id)
      .maybeSingle<ScoutIcp>();
    if (linked) return linked;
  }
  const { data: onboarding } = await supabase
    .from("icps")
    .select("id, name, criteria")
    .eq("account_id", accountId)
    .eq("source", "onboarding")
    .limit(1)
    .maybeSingle<ScoutIcp>();
  return onboarding ?? null;
}

/** Write the buyer profile to the SAME row `resolveScoutIcp` reads; create + link it if absent. */
export async function saveScoutIcp(
  supabase: SupabaseClient,
  args: { accountId: string; agentId: string; name: string; criteria: Record<string, unknown> }
): Promise<{ error: boolean }> {
  const { accountId, agentId, name, criteria } = args;
  const existing = await resolveScoutIcp(supabase, accountId, agentId);
  if (existing) {
    const { error } = await supabase
      .from("icps")
      .update({ name, criteria })
      .eq("account_id", accountId)
      .eq("id", existing.id);
    return { error: Boolean(error) };
  }
  const { data: created, error } = await supabase
    .from("icps")
    .insert({ account_id: accountId, name, criteria, source: "onboarding" })
    .select("id")
    .maybeSingle<{ id: string }>();
  if (error || !created) return { error: true };
  const { error: linkError } = await supabase
    .from("agent_icps")
    .insert({ agent_id: agentId, icp_id: created.id, account_id: accountId, position: 0 });
  return { error: Boolean(linkError) };
}

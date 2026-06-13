"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { parseCopyForm, parseScoutForm, MAX_ICPS } from "./validation";

export type AgentActionState = { error?: string };

const MAX_FILES = 5;
const MAX_FILE_BYTES = 5 * 1024 * 1024;

/** account comes from the validated session via RLS-scoped select — never from the form (rule 02) */
async function sessionAccount() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { supabase, user: null, account: null };
  const { data: account } = await supabase
    .from("accounts")
    .select("id, onboarding_icp")
    .limit(1)
    .maybeSingle<{ id: string; onboarding_icp: string | null }>();
  return { supabase, user, account };
}

type SupabaseServer = Awaited<ReturnType<typeof createClient>>;

/** Resolve ICP names to rows for an account — reuse same-named ICPs, create the rest. */
async function resolveIcpIds(
  supabase: SupabaseServer,
  accountId: string,
  names: string[]
): Promise<{ ok: true; ids: string[] } | { ok: false }> {
  const ids: string[] = [];
  for (const icpName of names.slice(0, MAX_ICPS)) {
    const { data: existing } = await supabase
      .from("icps")
      .select("id")
      .eq("account_id", accountId)
      .ilike("name", icpName)
      .limit(1)
      .maybeSingle<{ id: string }>();
    if (existing) {
      ids.push(existing.id);
      continue;
    }
    const { data: created, error } = await supabase
      .from("icps")
      .insert({ account_id: accountId, name: icpName, criteria: {}, source: "manual" })
      .select("id")
      .single<{ id: string }>();
    if (error || !created) return { ok: false };
    ids.push(created.id);
  }
  return { ok: true, ids };
}

/** Persist an Outreach agent's content: file/image uploads + pasted links (append-only). */
async function saveAgentContent(
  supabase: SupabaseServer,
  accountId: string,
  agentId: string,
  userId: string,
  formData: FormData,
  links: string[]
): Promise<AgentActionState> {
  const files = formData
    .getAll("files")
    .filter((f): f is File => f instanceof File && f.size > 0)
    .slice(0, MAX_FILES);
  for (const file of files) {
    if (file.size > MAX_FILE_BYTES) {
      return { error: `"${file.name}" is over 5 MB — host it as a link instead.` };
    }
    const path = `${accountId}/${agentId}/${Date.now()}-${file.name}`;
    const { error: uploadError } = await supabase.storage.from("agent-assets").upload(path, file);
    if (uploadError) return { error: `Could not upload "${file.name}". Please try again.` };
    await supabase.from("agent_assets").insert({
      account_id: accountId,
      agent_id: agentId,
      kind: file.type.startsWith("image/") ? "image" : "file",
      storage_path: path,
      filename: file.name,
      mime_type: file.type || null,
      size_bytes: file.size,
      created_by: userId,
    });
  }
  if (links.length > 0) {
    await supabase.from("agent_assets").insert(
      links.map((url) => ({
        account_id: accountId,
        agent_id: agentId,
        kind: "link",
        url,
        created_by: userId,
      }))
    );
  }
  return {};
}

export async function deployScoutAgent(
  _prev: AgentActionState,
  formData: FormData
): Promise<AgentActionState> {
  const parsed = parseScoutForm(formData);
  if (!parsed.ok) return { error: parsed.error };
  const { name, icps, runAtTime, cadence, timezone } = parsed.values;

  const { supabase, user, account } = await sessionAccount();
  if (!user || !account) return { error: "Your session expired. Sign in again." };

  const resolved = await resolveIcpIds(supabase, account.id, icps);
  if (!resolved.ok) return { error: "Could not save your ICPs. Please try again." };
  const icpIds = resolved.ids;

  const { data: agent, error: agentError } = await supabase
    .from("agents")
    .insert({
      account_id: account.id,
      kind: "scout",
      name,
      status: "live",
      config: { prospects_per_run: 25, min_score: 70 },
      run_at_time: runAtTime,
      cadence,
      timezone,
      // next_run_at stays null: the scheduler treats null as due, so the first
      // run kicks off within ~15 minutes of deploy, then settles into the schedule
      deployed_at: new Date().toISOString(),
      created_by: user.id,
    })
    .select("id")
    .single<{ id: string }>();
  if (agentError || !agent) {
    if (agentError?.code === "23505") {
      return { error: "You already have a Prospect Agent. Pause or edit it from the Agents page." };
    }
    return { error: "Could not deploy the agent. Only workspace admins can do this." };
  }

  const { error: linkError } = await supabase.from("agent_icps").insert(
    icpIds.map((icpId, position) => ({
      agent_id: agent.id,
      icp_id: icpId,
      account_id: account.id,
      position,
    }))
  );
  if (linkError) return { error: "Could not link your ICPs. Please try again." };

  revalidatePath("/agents");
  redirect("/agents?deployed=scout");
}

export async function deployCopyAgent(
  _prev: AgentActionState,
  formData: FormData
): Promise<AgentActionState> {
  const parsed = parseCopyForm(formData);
  if (!parsed.ok) return { error: parsed.error };
  const { name, cta, links, channels, sendMode } = parsed.values;

  const { supabase, user, account } = await sessionAccount();
  if (!user || !account) return { error: "Your session expired. Sign in again." };

  // the Outreach agent (kind 'copy') inherits the Scout's targeting — require a deployed Scout first
  const { data: scout } = await supabase
    .from("agents")
    .select("id")
    .eq("account_id", account.id)
    .eq("kind", "scout")
    .limit(1)
    .maybeSingle<{ id: string }>();
  if (!scout) return { error: "Deploy a Prospect Agent first — it feeds this agent its leads." };

  const { data: scoutIcps } = await supabase
    .from("agent_icps")
    .select("icps(name)")
    .eq("agent_id", scout.id)
    .order("position");
  const icpNames = (scoutIcps ?? [])
    .map((r) => (r.icps as unknown as { name: string } | null)?.name)
    .filter((n): n is string => Boolean(n))
    .slice(0, MAX_ICPS);

  const channelList = [
    ...(channels.email ? ["email"] : []),
    ...(channels.linkedin ? ["linkedin"] : []),
  ];

  // internal execution campaign — never a user surface (agents are the front door)
  const { data: campaign, error: campaignError } = await supabase
    .from("campaigns")
    .insert({
      account_id: account.id,
      name: `${name} (agent)`,
      status: "active",
      channels: channelList,
      targeting: icpNames.map((value) => ({ type: "icp", value })),
      copywriting_mode: "agent",
      send_mode: sendMode,
      created_by: user.id,
    })
    .select("id")
    .single<{ id: string }>();
  if (campaignError || !campaign) {
    return { error: "Could not deploy the agent. Only workspace admins can do this." };
  }

  const { data: agent, error: agentError } = await supabase
    .from("agents")
    .insert({
      account_id: account.id,
      kind: "copy",
      name,
      status: "live",
      config: { cta, channels },
      campaign_id: campaign.id,
      deployed_at: new Date().toISOString(),
      created_by: user.id,
    })
    .select("id")
    .single<{ id: string }>();
  if (agentError || !agent) {
    if (agentError?.code === "23505") {
      return { error: "You already have an Outreach Agent. Pause or edit it from the Agents page." };
    }
    return { error: "Could not deploy the agent. Only workspace admins can do this." };
  }

  // content uploads land in the private agent-assets bucket under <account>/<agent>/
  const content = await saveAgentContent(supabase, account.id, agent.id, user.id, formData, links);
  if (content.error) return content;

  revalidatePath("/agents");
  redirect("/agents?deployed=copy");
}

/**
 * Edit a deployed Prospect (Scout) agent and save it as the new config. Reuses
 * the wizard + the same validation as deploy; status/schedule-state are left
 * intact (the scheduler picks up the new run time on its next cycle).
 */
export async function updateScoutAgent(
  _prev: AgentActionState,
  formData: FormData
): Promise<AgentActionState> {
  const parsed = parseScoutForm(formData);
  if (!parsed.ok) return { error: parsed.error };
  const { name, icps, runAtTime, cadence, timezone } = parsed.values;

  const { supabase, user, account } = await sessionAccount();
  if (!user || !account) return { error: "Your session expired. Sign in again." };

  const { data: agent } = await supabase
    .from("agents")
    .select("id, config")
    .eq("account_id", account.id)
    .eq("kind", "scout")
    .limit(1)
    .maybeSingle<{ id: string; config: Record<string, unknown> | null }>();
  if (!agent) return { error: "No Prospect Agent to edit. Deploy one first." };

  const resolved = await resolveIcpIds(supabase, account.id, icps);
  if (!resolved.ok) return { error: "Could not save your ICPs. Please try again." };

  const { error: updateError } = await supabase
    .from("agents")
    .update({ name, config: { ...(agent.config ?? {}) }, run_at_time: runAtTime, cadence, timezone })
    .eq("id", agent.id); // RLS scopes to the admin's account (rule 02)
  if (updateError) return { error: "Could not save changes. Only workspace admins can do this." };

  // replace the ICP links so removed targets drop and order is preserved
  await supabase.from("agent_icps").delete().eq("agent_id", agent.id);
  const { error: linkError } = await supabase.from("agent_icps").insert(
    resolved.ids.map((icpId, position) => ({
      agent_id: agent.id,
      icp_id: icpId,
      account_id: account.id,
      position,
    }))
  );
  if (linkError) return { error: "Could not link your ICPs. Please try again." };

  revalidatePath("/agents");
  redirect("/agents?updated=scout");
}

/**
 * Edit a deployed Outreach (Copy) agent and save it as the new config. Targeting
 * stays inherited from the Scout; content uploads are append-only (existing
 * assets are kept).
 */
export async function updateCopyAgent(
  _prev: AgentActionState,
  formData: FormData
): Promise<AgentActionState> {
  const parsed = parseCopyForm(formData);
  if (!parsed.ok) return { error: parsed.error };
  const { name, cta, links, channels, sendMode } = parsed.values;

  const { supabase, user, account } = await sessionAccount();
  if (!user || !account) return { error: "Your session expired. Sign in again." };

  const { data: agent } = await supabase
    .from("agents")
    .select("id, config, campaign_id")
    .eq("account_id", account.id)
    .eq("kind", "copy")
    .limit(1)
    .maybeSingle<{ id: string; config: Record<string, unknown> | null; campaign_id: string | null }>();
  if (!agent) return { error: "No Outreach Agent to edit. Deploy one first." };

  const channelList = [
    ...(channels.email ? ["email"] : []),
    ...(channels.linkedin ? ["linkedin"] : []),
  ];

  const { error: updateError } = await supabase
    .from("agents")
    .update({ name, config: { ...(agent.config ?? {}), cta, channels } })
    .eq("id", agent.id); // RLS scopes to the admin's account (rule 02)
  if (updateError) return { error: "Could not save changes. Only workspace admins can do this." };

  if (agent.campaign_id) {
    await supabase
      .from("campaigns")
      .update({ name: `${name} (agent)`, channels: channelList, send_mode: sendMode })
      .eq("id", agent.campaign_id);
  }

  const content = await saveAgentContent(supabase, account.id, agent.id, user.id, formData, links);
  if (content.error) return content;

  revalidatePath("/agents");
  redirect("/agents?updated=copy");
}

/** Flip an Outreach agent's campaign between review and automatic sending (rule 08). */
export async function updateSendMode(
  _prev: AgentActionState,
  formData: FormData
): Promise<AgentActionState> {
  const campaignId = String(formData.get("campaignId") ?? "");
  const sendMode = String(formData.get("sendMode") ?? "");
  if (!campaignId || (sendMode !== "review" && sendMode !== "automatic")) {
    return { error: "Invalid request." };
  }
  const supabase = await createClient();
  const { error } = await supabase
    .from("campaigns")
    .update({ send_mode: sendMode }) // RLS scopes to the admin's account (rule 02)
    .eq("id", campaignId);
  if (error) return { error: "Could not update send mode. Only workspace admins can do this." };
  revalidatePath("/agents");
  return {};
}

export async function setAgentStatus(
  _prev: AgentActionState,
  formData: FormData
): Promise<AgentActionState> {
  const agentId = String(formData.get("agentId") ?? "");
  const status = String(formData.get("status") ?? "");
  if (!agentId || (status !== "live" && status !== "paused")) {
    return { error: "Invalid request." };
  }
  const supabase = await createClient();
  const { error } = await supabase
    .from("agents")
    .update({ status }) // RLS scopes to the admin's account (rule 02)
    .eq("id", agentId);
  if (error) return { error: "Could not update the agent. Only workspace admins can do this." };
  revalidatePath("/agents");
  return {};
}

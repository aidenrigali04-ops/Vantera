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

export async function deployScoutAgent(
  _prev: AgentActionState,
  formData: FormData
): Promise<AgentActionState> {
  const parsed = parseScoutForm(formData);
  if (!parsed.ok) return { error: parsed.error };
  const { name, icps, runAtTime, cadence, timezone } = parsed.values;

  const { supabase, user, account } = await sessionAccount();
  if (!user || !account) return { error: "Your session expired. Sign in again." };

  // resolve ICP names to rows (reuse same-named ICPs, create the rest)
  const icpIds: string[] = [];
  for (const icpName of icps.slice(0, MAX_ICPS)) {
    const { data: existing } = await supabase
      .from("icps")
      .select("id")
      .eq("account_id", account.id)
      .ilike("name", icpName)
      .limit(1)
      .maybeSingle<{ id: string }>();
    if (existing) {
      icpIds.push(existing.id);
      continue;
    }
    const { data: created, error } = await supabase
      .from("icps")
      .insert({ account_id: account.id, name: icpName, criteria: {}, source: "manual" })
      .select("id")
      .single<{ id: string }>();
    if (error || !created) return { error: "Could not save your ICPs. Please try again." };
    icpIds.push(created.id);
  }

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
  const { name, cta, links, channels } = parsed.values;

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
      send_mode: "review",
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
  const files = formData
    .getAll("files")
    .filter((f): f is File => f instanceof File && f.size > 0)
    .slice(0, MAX_FILES);
  for (const file of files) {
    if (file.size > MAX_FILE_BYTES) {
      return { error: `"${file.name}" is over 5 MB — host it as a link instead.` };
    }
    const path = `${account.id}/${agent.id}/${Date.now()}-${file.name}`;
    const { error: uploadError } = await supabase.storage.from("agent-assets").upload(path, file);
    if (uploadError) return { error: `Could not upload "${file.name}". Please try again.` };
    await supabase.from("agent_assets").insert({
      account_id: account.id,
      agent_id: agent.id,
      kind: file.type.startsWith("image/") ? "image" : "file",
      storage_path: path,
      filename: file.name,
      mime_type: file.type || null,
      size_bytes: file.size,
      created_by: user.id,
    });
  }
  if (links.length > 0) {
    await supabase.from("agent_assets").insert(
      links.map((url) => ({
        account_id: account.id,
        agent_id: agent.id,
        kind: "link",
        url,
        created_by: user.id,
      }))
    );
  }

  revalidatePath("/agents");
  redirect("/agents?deployed=copy");
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

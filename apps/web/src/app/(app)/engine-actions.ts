"use server";

import { revalidatePath } from "next/cache";
import type { SupabaseClient } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";

/**
 * The workspace engine controls (Dashboard blueprint v1.0 §6.1; UX-2 Task 9).
 *
 * The jobs don't read `accounts.paused_at` — sourcing runs gate on `agents.status = 'live'` and
 * sends gate on `accounts.outreach_paused` — so "pause everything" writes all three: the
 * `paused_at` stamp (what the UI shows), `outreach_paused` (stops sends), and every live agent
 * → paused (stops sourcing + drafting). Resume reverses all three. Approvals stay open.
 *
 * The account is always resolved from the session through RLS (rule 02) — the client never
 * supplies an account id. Writes are RLS-scoped too: a member the policy doesn't let write
 * gets zero rows back (not an error), which is why each write selects what it changed and
 * treats an empty result as a refusal.
 */
type EngineResult = { error?: string };

const ADMIN_ONLY = "Only workspace admins can do this.";

/** Every chip-changing write revalidates the layout — it does not re-render on navigation. */
function revalidateEngineSurfaces() {
  revalidatePath("/", "layout");
  revalidatePath("/today");
  revalidatePath("/playbook");
  revalidatePath("/approvals");
}

async function sessionClient(): Promise<{ supabase: SupabaseClient; accountId: string } | null> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;
  const { data: account } = await supabase
    .from("accounts")
    .select("id")
    .limit(1)
    .maybeSingle<{ id: string }>();
  if (!account) return null;
  return { supabase, accountId: account.id };
}

async function setEnginePaused(paused: boolean, failure: string): Promise<EngineResult> {
  const session = await sessionClient();
  if (!session) return { error: failure };
  const { supabase, accountId } = session;

  // The account row first: it is the admin check. A refused write touches no agent.
  const { data: updated, error } = await supabase
    .from("accounts")
    .update(paused ? { paused_at: new Date().toISOString(), outreach_paused: true } : { paused_at: null, outreach_paused: false })
    .eq("id", accountId)
    .select("id")
    .returns<{ id: string }[]>();
  if (error || !updated || updated.length === 0) return { error: failure };

  // Zero agents (none deployed, or none in the from-status) is a valid no-op, not a refusal.
  const { error: agentsError } = await supabase
    .from("agents")
    .update({ status: paused ? "paused" : "live" })
    .eq("status", paused ? "live" : "paused")
    .select("id")
    .returns<{ id: string }[]>();
  if (agentsError) return { error: failure };

  revalidateEngineSurfaces();
  return {};
}

/** Stop sourcing, drafting, and sending for the session's workspace. */
export async function pauseEngine(): Promise<EngineResult> {
  return setEnginePaused(true, `Could not pause the engine. ${ADMIN_ONLY}`);
}

/** Pick sourcing, drafting, and sending back up. */
export async function resumeEngine(): Promise<EngineResult> {
  return setEnginePaused(false, `Could not resume the engine. ${ADMIN_ONLY}`);
}

const GROUP_KINDS = { sourcing: ["scout", "intent"], outreach: ["copy"] } as const;

/**
 * The popover's two switches: Sourcing (Prospect + Intent agents) and Outreach (the Outreach
 * agent). Draft agents are never deployed by a switch; agents already in the target status
 * are left alone, so "nothing to change" is a no-op rather than a refusal.
 */
export async function setAgentGroup(group: "sourcing" | "outreach", status: "live" | "paused"): Promise<EngineResult> {
  if (!(group in GROUP_KINDS) || (status !== "live" && status !== "paused")) return { error: "Invalid request." };
  const failure = `Could not update ${group === "sourcing" ? "sourcing" : "outreach"}. ${ADMIN_ONLY}`;
  const session = await sessionClient();
  if (!session) return { error: failure };
  const { supabase } = session;

  const { data: agents, error: readError } = await supabase
    .from("agents")
    .select("id, status")
    .in("kind", [...GROUP_KINDS[group]])
    .returns<{ id: string; status: string }[]>();
  if (readError) return { error: failure };
  const from = status === "live" ? "paused" : "live";
  const ids = (agents ?? []).filter((a) => a.status === from).map((a) => a.id);
  if (ids.length === 0) return {};

  const { data: updated, error } = await supabase
    .from("agents")
    .update({ status })
    .in("id", ids)
    .select("id")
    .returns<{ id: string }[]>();
  if (error || !updated || updated.length === 0) return { error: failure };

  revalidateEngineSurfaces();
  return {};
}

"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

/**
 * The workspace engine pause (Dashboard blueprint v1.0 §6.1; migration 0063). Setting
 * `accounts.paused_at` stops sourcing and sending; approvals stay open. Clearing it resumes.
 *
 * The account is always resolved from the session through RLS (rule 02) — the client never
 * supplies an account id. The update is also RLS-scoped: a member the policy doesn't let
 * write the row gets zero rows back (not an error), which is why the write selects what it
 * changed and treats an empty result as a refusal.
 */
type EngineResult = { error?: string };

async function setEnginePaused(pausedAt: string | null, failure: string): Promise<EngineResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: failure };

  const { data: account } = await supabase
    .from("accounts")
    .select("id")
    .limit(1)
    .maybeSingle<{ id: string }>();
  if (!account) return { error: failure };

  const { data: updated, error } = await supabase
    .from("accounts")
    .update({ paused_at: pausedAt })
    .eq("id", account.id)
    .select("id")
    .returns<{ id: string }[]>();
  if (error || !updated || updated.length === 0) return { error: failure };

  revalidatePath("/today");
  revalidatePath("/", "layout");
  return {};
}

/** Stop sourcing and sending for the session's workspace. */
export async function pauseEngine(): Promise<EngineResult> {
  return setEnginePaused(
    new Date().toISOString(),
    "Could not pause the engine. Only workspace admins can do this."
  );
}

/** Let the engine pick sourcing and sending back up. */
export async function resumeEngine(): Promise<EngineResult> {
  return setEnginePaused(null, "Could not resume the engine. Only workspace admins can do this.");
}

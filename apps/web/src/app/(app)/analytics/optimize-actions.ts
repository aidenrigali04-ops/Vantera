"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { proposeChallengerStrategy, type FunnelStageKey } from "@vantera/agent-brains";
import type { SupabaseClient } from "@supabase/supabase-js";

// Owner controls for the self-optimizing loop (Phase 3, suggest-only). Every write is RLS-scoped:
// the optimization_experiments/playbook manage policies require is_account_admin, so a non-admin
// simply can't start/adopt/discard. accountId is resolved from the session, never trusted from input.

async function sessionAccountId(db: SupabaseClient): Promise<string | null> {
  const { data } = await db.from("accounts").select("id").limit(1).maybeSingle<{ id: string }>();
  return data?.id ?? null;
}

/** Start a copy-strategy experiment for the diagnosed leak. The one-live unique index prevents a
 *  second concurrent experiment; a non-copy leak has no challenger and is a no-op. */
export async function startExperiment(formData: FormData): Promise<void> {
  const stageKey = String(formData.get("stageKey") ?? "") as FunnelStageKey;
  const challenger = proposeChallengerStrategy(stageKey);
  if (!challenger) return;

  const db = await createClient();
  const accountId = await sessionAccountId(db);
  if (!accountId) return;

  const { data: pb } = await db
    .from("optimization_playbook")
    .select("champion_strategy")
    .eq("account_id", accountId)
    .maybeSingle<{ champion_strategy: unknown }>();

  await db.from("optimization_experiments").insert({
    account_id: accountId,
    stage_key: stageKey,
    champion_strategy: pb?.champion_strategy ?? {},
    challenger_strategy: challenger,
    allocation_pct: 25,
    min_sample: 30,
    status: "running",
  });
  revalidatePath("/dashboard");
}

/** Adopt a proven challenger: it becomes the account's champion (version-bumped), experiment closes. */
export async function adoptExperiment(formData: FormData): Promise<void> {
  const id = String(formData.get("id") ?? "");
  if (!id) return;

  const db = await createClient();
  const { data: exp } = await db
    .from("optimization_experiments")
    .select("account_id, challenger_strategy, status")
    .eq("id", id)
    .maybeSingle<{ account_id: string; challenger_strategy: unknown; status: string }>();
  if (!exp || exp.status !== "ready_to_adopt") return;

  const { data: cur } = await db
    .from("optimization_playbook")
    .select("version")
    .eq("account_id", exp.account_id)
    .maybeSingle<{ version: number }>();

  await db.from("optimization_playbook").upsert(
    {
      account_id: exp.account_id,
      champion_strategy: exp.challenger_strategy ?? {},
      version: (cur?.version ?? 0) + 1,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "account_id" }
  );
  await db
    .from("optimization_experiments")
    .update({ status: "adopted", concluded_at: new Date().toISOString() })
    .eq("id", id);
  revalidatePath("/dashboard");
}

/** Keep the current champion: discard the challenger. */
export async function discardExperiment(formData: FormData): Promise<void> {
  const id = String(formData.get("id") ?? "");
  if (!id) return;
  const db = await createClient();
  await db
    .from("optimization_experiments")
    .update({ status: "discarded", concluded_at: new Date().toISOString() })
    .eq("id", id);
  revalidatePath("/dashboard");
}

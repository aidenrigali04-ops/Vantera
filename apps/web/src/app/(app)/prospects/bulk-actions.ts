"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import { normalizeSuppressionValue } from "@/lib/suppression";

export type BulkResult = { error?: string; done?: number; skipped?: number };

const MAX_BULK = 100;

/**
 * R4 bulk actions. Authorization model: the ids are re-selected through RLS first — the
 * rows that come back ARE the caller's authorized set (rule 02; ids from the client are
 * never trusted). Writes then go through the same RLS-gated client (leads_manage +
 * scheduled-sends policies are admin-only), so a member without rights gets a clean error.
 */
async function authorizedLeads(ids: string[]) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { supabase, rows: null as null | { id: string; status: string; linkedin_url: string | null }[] };
  const clean = [...new Set(ids)].filter((id) => typeof id === "string").slice(0, MAX_BULK);
  if (clean.length === 0) return { supabase, rows: [] };
  const { data } = await supabase
    .from("leads")
    .select("id, status, linkedin_url")
    .in("id", clean)
    .returns<{ id: string; status: string; linkedin_url: string | null }[]>();
  return { supabase, rows: data ?? [] };
}

/**
 * Stop the leads' follow-up sequences so no new touch is drafted after they leave outreach.
 * sequence_runs has no client write policy, so this goes through the service role — safe because
 * `leadIds` came back from the RLS-scoped authorizedLeads read (the caller owns them).
 */
async function stopSequences(leadIds: string[]): Promise<boolean> {
  const { error } = await createServiceClient()
    .from("sequence_runs")
    .update({ status: "stopped" })
    .in("lead_id", leadIds)
    .in("status", ["active", "exhausted", "paused_reply"]);
  if (error) console.error("bulk: stopping sequences failed", { count: leadIds.length, error: error.message });
  return !error;
}

/** Archive: outreach stops (queued drafts canceled), history kept. Converted leads are skipped. */
export async function bulkArchiveLeads(ids: string[]): Promise<BulkResult> {
  const { supabase, rows } = await authorizedLeads(ids);
  if (rows === null) return { error: "Your session expired. Sign in again." };
  const targets = rows.filter((r) => r.status !== "converted" && r.status !== "archived");
  if (targets.length === 0) return { done: 0, skipped: rows.length };

  const targetIds = targets.map((r) => r.id);
  const { error } = await supabase.from("leads").update({ status: "archived" }).in("id", targetIds);
  if (error) return { error: "Could not archive. Only workspace admins can manage prospects." };

  const { error: cancelError } = await supabase
    .from("scheduled_sends")
    .update({ status: "canceled" })
    .in("lead_id", targetIds)
    .in("status", ["pending_review", "approved", "scheduled"]);
  const stopped = await stopSequences(targetIds);

  revalidatePath("/prospects");
  if (cancelError || !stopped) {
    return { error: "Prospects were archived, but some queued messages may not have been stopped. Try again." };
  }
  return { done: targets.length, skipped: rows.length - targets.length };
}

/**
 * Suppress: permanent (rule 11 — entries never expire). Inserts each lead's LinkedIn URL
 * into the suppression list and flips their queued drafts, exactly like a manual
 * suppression add. Leads without a LinkedIn URL are skipped and reported.
 */
export async function bulkSuppressLeads(ids: string[]): Promise<BulkResult> {
  const { supabase, rows } = await authorizedLeads(ids);
  if (rows === null) return { error: "Your session expired. Sign in again." };
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const { data: account } = await supabase
    .from("accounts")
    .select("id")
    .limit(1)
    .maybeSingle<{ id: string }>();
  if (!account || !user) return { error: "Your session expired. Sign in again." };

  const targets = rows.filter((r) => (r.linkedin_url ?? "").trim().length > 0);
  if (targets.length === 0) return { done: 0, skipped: rows.length };

  const { error } = await supabase.from("suppression_entries").upsert(
    targets.map((r) => ({
      account_id: account.id,
      kind: "linkedin" as const,
      // normalized exactly like every send-time suppression check (lowercase, no trailing slash)
      value: normalizeSuppressionValue("linkedin", r.linkedin_url as string),
      source: "manual" as const,
      note: "Bulk suppressed from Prospects",
      created_by: user.id,
    })),
    { onConflict: "account_id,kind,value", ignoreDuplicates: true }
  );
  if (error) return { error: "Could not suppress. Only workspace admins can manage suppression." };

  // rule 11: a suppressed contact never stays queued, and their sequence never drafts again.
  await supabase
    .from("scheduled_sends")
    .update({ status: "suppressed" })
    .in("lead_id", targets.map((r) => r.id))
    .in("status", ["pending_review", "approved", "scheduled"]);
  await stopSequences(targets.map((r) => r.id));

  revalidatePath("/prospects");
  revalidatePath("/approvals");
  return { done: targets.length, skipped: rows.length - targets.length };
}

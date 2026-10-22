import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { FitVerdict } from "./fit";

/**
 * The one lead_feedback writer (ML-4): upsert on lead_id, author pinned to the caller (the RLS
 * policy requires created_by = auth.uid()). `reason` is written only when given, so callers that
 * omit it leave an existing reason untouched. Goes through the caller's RLS-scoped client.
 */
export async function upsertLeadFit(
  supabase: SupabaseClient,
  input: { accountId: string; leadId: string; verdict: FitVerdict; reason?: string; userId: string }
): Promise<{ error: boolean }> {
  const row = {
    account_id: input.accountId,
    lead_id: input.leadId,
    verdict: input.verdict,
    ...(input.reason !== undefined ? { reason: input.reason } : {}),
    created_by: input.userId,
  };
  const { error } = await supabase.from("lead_feedback").upsert(row, { onConflict: "lead_id" });
  return { error: Boolean(error) };
}

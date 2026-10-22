"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { parseFitVerdict, type FitVerdict } from "@/lib/learning/fit";
import { upsertLeadFit } from "@/lib/learning/fit-write";

export type FitState = { verdict?: FitVerdict | null; error?: string };

// One message for every failure: distinguishing "no such lead" from "not allowed" would let a
// caller probe other workspaces' lead ids (RLS audit 2026-10-21).
const FAILED = "Could not save that. Please try again.";

/**
 * ML-4: record "Good fit" / "Not a fit" on a prospect (any workspace member), or clear it. The
 * account comes from the session via the RLS-scoped accounts read (rule 02) — never the client.
 * The upsert re-pins created_by to the caller (the update policy requires it); updated_at is
 * re-stamped by the table trigger. "Not a fit" keeps the lead out of drafting.
 */
export async function setLeadFit(_prev: FitState, formData: FormData): Promise<FitState> {
  const leadId = String(formData.get("leadId") ?? "");
  const verdict = parseFitVerdict(formData.get("verdict"));
  if (!leadId || !verdict) return { error: FAILED };

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Your session expired. Sign in again." };

  if (verdict === "clear") {
    const { error } = await supabase.from("lead_feedback").delete().eq("lead_id", leadId);
    if (error) return { error: FAILED };
  } else {
    const { data: account } = await supabase.from("accounts").select("id").limit(1).maybeSingle();
    if (!account) return { error: FAILED };
    const { error } = await upsertLeadFit(supabase, { accountId: account.id, leadId, verdict, userId: user.id });
    if (error) return { error: FAILED };
  }

  revalidatePath("/prospects");
  revalidatePath(`/prospects/${leadId}`);
  return { verdict: verdict === "clear" ? null : verdict };
}

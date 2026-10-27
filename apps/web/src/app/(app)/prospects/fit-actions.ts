"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { parseFitReason, parseFitVerdict, type FitVerdict } from "@/lib/learning/fit";

export type FitState = { verdict?: FitVerdict | null; error?: string };

// One message for every failure: distinguishing "no such lead" from "not allowed" would let a
// caller probe other workspaces' lead ids (RLS audit 2026-10-21).
const FAILED = "Could not save that. Please try again.";

/**
 * ML-4: record "Good fit" / "Not a fit" on a prospect (any workspace member), or clear it. The
 * account comes from the session via the RLS-scoped accounts read (rule 02) — never the client.
 * The upsert re-pins created_by to the caller (the update policy requires it); updated_at is
 * re-stamped by the table trigger. "Not a fit" keeps the lead out of drafting and withdraws any
 * draft already waiting in Approvals (T5) — that write is admin-only under RLS, so for a member
 * it matches 0 rows and the draft stays for an admin to reject; both are normal. An optional
 * `reason` (1..200 chars, trimmed) rides along into lead_feedback.reason; blank is omitted.
 */
export async function setLeadFit(_prev: FitState, formData: FormData): Promise<FitState> {
  const leadId = String(formData.get("leadId") ?? "");
  const verdict = parseFitVerdict(formData.get("verdict"));
  if (!leadId || !verdict) return { error: FAILED };
  const reason = parseFitReason(formData.get("reason"));
  if (!reason.ok) return { error: "Keep the reason under 200 characters." };

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
    const { error } = await supabase
      .from("lead_feedback")
      .upsert(
        {
          account_id: account.id,
          lead_id: leadId,
          verdict,
          created_by: user.id,
          ...(reason.reason ? { reason: reason.reason } : {}),
        },
        { onConflict: "lead_id" }
      );
    if (error) return { error: FAILED };
    if (verdict === "not_fit") {
      const { error: cancelError } = await supabase
        .from("scheduled_sends")
        .update({ status: "canceled" })
        .eq("lead_id", leadId)
        .eq("status", "pending_review")
        .select("id");
      // The verdict is saved either way; a failed withdrawal leaves the draft for manual reject.
      if (cancelError) console.error("setLeadFit: couldn't withdraw queued drafts", { leadId, message: cancelError.message });
      revalidatePath("/approvals");
      revalidatePath("/today");
    }
  }

  revalidatePath("/prospects");
  revalidatePath(`/prospects/${leadId}`);
  return { verdict: verdict === "clear" ? null : verdict };
}

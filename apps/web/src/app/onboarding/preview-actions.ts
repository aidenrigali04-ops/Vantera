"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { upsertLeadFit } from "@/lib/learning/fit-write";

/**
 * Step 3 · First prospects. The account always comes from the session via the RLS-scoped
 * accounts read (rule 02) — never from the client.
 */

const FAILED = "Could not remove that prospect. Please try again.";

/**
 * "Not a fit" on a preview card: record the verdict (it feeds the qualification brain and keeps
 * the lead out of drafting) and cancel any queued draft for that lead as a wrong-person reject.
 * The re-render then shows the next scored lead in the freed slot.
 */
export async function rejectPreviewLead(leadId: string): Promise<{ error?: string }> {
  if (!leadId) return { error: FAILED };
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Your session expired. Sign in again." };

  const { data: account } = await supabase.from("accounts").select("id").limit(1).maybeSingle<{ id: string }>();
  if (!account) return { error: FAILED };

  const { error: fitError } = await upsertLeadFit(supabase, {
    accountId: account.id,
    leadId,
    verdict: "not_fit",
    reason: "onboarding_preview",
    userId: user.id,
  });
  if (fitError) return { error: FAILED };

  const { error: sendError } = await supabase
    .from("scheduled_sends")
    .update({ status: "canceled", rejection_reason: "wrong_person" })
    .eq("account_id", account.id)
    .eq("lead_id", leadId)
    .in("status", ["pending_review", "approved"]);
  if (sendError) return { error: FAILED };

  revalidatePath("/onboarding");
  return {};
}

/** Continue: stamp the milestone once and move on. Never waits on the preview run. */
export async function confirmProspects(): Promise<never> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: account } = await supabase
    .from("accounts")
    .select("id, prospects_reviewed_at")
    .limit(1)
    .maybeSingle<{ id: string; prospects_reviewed_at: string | null }>();
  if (!account) redirect("/onboarding");

  if (!account.prospects_reviewed_at) {
    const { error } = await supabase
      .from("accounts")
      .update({ prospects_reviewed_at: new Date().toISOString() })
      .eq("id", account.id)
      .is("prospects_reviewed_at", null);
    // a failed stamp must not trap the user on this step — the milestone is bookkeeping
    if (error) console.error("confirmProspects: stamp failed (non-blocking)", error);
  }

  redirect("/onboarding?done=prospects");
}

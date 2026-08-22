"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import { recordSecurityEvent } from "@/lib/security/audit";

export type EraseState = { error?: string; erased?: boolean };

/**
 * GDPR erasure of a single prospect (rule 11). Suppresses the lead's email + LinkedIn first so
 * they can never be re-contacted (suppression survives erasure), then hard-deletes the lead —
 * the FK cascade wipes enrichment, sends, and replies. Admin-only; audited.
 *
 * account is resolved from the session (rule 02); the privileged writes use the service client
 * only AFTER a session-scoped ownership + admin-role check.
 */
export async function eraseLead(leadId: string): Promise<EraseState> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Your session expired. Sign in again." };

  const { data: account } = await supabase.from("accounts").select("id").limit(1).maybeSingle();
  if (!account) return { error: "No workspace found." };

  const { data: membership } = await supabase
    .from("account_members")
    .select("role")
    .eq("user_id", user.id)
    .eq("account_id", account.id)
    .maybeSingle<{ role: string }>();
  if (!membership || (membership.role !== "owner" && membership.role !== "admin")) {
    return { error: "Only workspace admins can erase a prospect." };
  }

  // RLS-scoped load confirms the lead belongs to the caller's account before any privileged write.
  const { data: lead } = await supabase
    .from("leads")
    .select("id, account_id, email, linkedin_url")
    .eq("id", leadId)
    .maybeSingle<{ id: string; account_id: string; email: string | null; linkedin_url: string | null }>();
  if (!lead || lead.account_id !== account.id) return { error: "Prospect not found." };

  const service = createServiceClient();
  const suppress = async (kind: "email" | "linkedin", value: string) => {
    await service.from("suppression_entries").upsert(
      { account_id: account.id, kind, value, source: "gdpr", lead_id: null },
      { onConflict: "account_id,kind,value", ignoreDuplicates: true }
    );
  };
  if (lead.email) await suppress("email", lead.email);
  if (lead.linkedin_url) await suppress("linkedin", lead.linkedin_url);

  const { error } = await service.from("leads").delete().eq("id", leadId).eq("account_id", account.id);
  if (error) return { error: "Could not erase the prospect. Please try again." };

  await recordSecurityEvent({
    eventType: "lead.erased",
    severity: "warn",
    accountId: account.id,
    actorUserId: user.id,
    metadata: { leadId }, // identifiers only — no email/linkedin in the audit record
  });
  revalidatePath("/prospects");
  return { erased: true };
}

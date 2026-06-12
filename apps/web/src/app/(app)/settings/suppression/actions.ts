"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { parseSuppressionInput } from "@/lib/suppression";

export type SuppressionActionState = { error?: string; added?: string };

export async function addSuppressionEntry(
  _prev: SuppressionActionState,
  formData: FormData
): Promise<SuppressionActionState> {
  const parsed = parseSuppressionInput(
    String(formData.get("kind") ?? ""),
    String(formData.get("value") ?? ""),
    formData.get("note") ? String(formData.get("note")) : null
  );
  if (!parsed.ok) return { error: parsed.error };
  const { kind, value, note } = parsed.values;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Your session expired. Sign in again." };
  // account from the validated session via RLS-scoped select — never from the form (rule 02)
  const { data: account } = await supabase
    .from("accounts")
    .select("id")
    .limit(1)
    .maybeSingle<{ id: string }>();
  if (!account) return { error: "Your session expired. Sign in again." };

  const { error } = await supabase.from("suppression_entries").insert({
    account_id: account.id,
    kind,
    value,
    source: "manual",
    note,
    created_by: user.id,
  });
  if (error) {
    if (error.code === "23505") return { error: "That contact is already suppressed." };
    return { error: "Could not add the entry. Only workspace admins can manage suppression." };
  }

  // rule 11: a suppressed contact never stays queued — flip matching drafts on this channel
  const { data: matchedLeads } = await supabase
    .from("leads")
    .select("id")
    // ilike with no wildcard = exact case-insensitive; linkedin gets % for trailing-slash variants
    .ilike(kind === "email" ? "email" : "linkedin_url", kind === "email" ? value : `${value}%`);
  const leadIds = (matchedLeads ?? []).map((l) => l.id);
  if (leadIds.length > 0) {
    await supabase
      .from("scheduled_sends")
      .update({ status: "suppressed" })
      .in("lead_id", leadIds)
      .eq("channel", kind)
      .in("status", ["pending_review", "approved"]);
  }

  revalidatePath("/settings/suppression");
  revalidatePath("/review");
  return { added: value };
}

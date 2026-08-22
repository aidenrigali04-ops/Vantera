"use server";

import { revalidatePath } from "next/cache";
import { tasks } from "@trigger.dev/sdk";
import { createClient } from "@/lib/supabase/server";
import { validateManualLead } from "@/lib/validation";
import { normalizeSuppressionValue } from "@/lib/suppression";

export type AddLeadState = { error?: string; leadId?: string };

/**
 * R6: the user adds a prospect by hand. source='manual' is an origin label, never a bypass —
 * the insert is suppression-checked (rule 11) and duplicate-checked, then the lead runs
 * through the SAME rules gate + AI rank as discovery via the qualify-lead task (rule 06).
 * RLS (leads_manage) gates the insert to workspace admins.
 */
export async function addManualLead(formData: FormData): Promise<AddLeadState> {
  const parsed = validateManualLead({
    firstName: String(formData.get("firstName") ?? ""),
    lastName: String(formData.get("lastName") ?? ""),
    title: String(formData.get("title") ?? ""),
    companyName: String(formData.get("companyName") ?? ""),
    linkedinUrl: String(formData.get("linkedinUrl") ?? ""),
  });
  if (!parsed.ok) return { error: parsed.error };
  const v = parsed.values;

  const supabase = await createClient();
  const { data: account } = await supabase.from("accounts").select("id").limit(1).maybeSingle();
  if (!account) return { error: "No workspace found." };

  // Rule 11: never bring a suppressed profile back into the funnel.
  const normalized = normalizeSuppressionValue("linkedin", v.linkedinUrl);
  const { data: suppressed } = await supabase
    .from("suppression_entries")
    .select("id")
    .eq("kind", "linkedin")
    .eq("value", normalized)
    .limit(1)
    .maybeSingle();
  if (suppressed) {
    return { error: "That profile is on your do-not-contact list — it can't be added as a prospect." };
  }

  // One person, one lead: the generated linkedin_url_normalized column is the dedupe key.
  const { data: existing } = await supabase
    .from("leads")
    .select("id")
    .eq("linkedin_url_normalized", normalized)
    .limit(1)
    .maybeSingle();
  if (existing) return { error: "Already in your prospects.", leadId: existing.id };

  // The account's ICP gives the qualification run its criteria; null is fine (gate defers).
  const { data: icp } = await supabase.from("icps").select("id").limit(1).maybeSingle();

  const { data: inserted, error } = await supabase
    .from("leads")
    .insert({
      account_id: account.id,
      icp_id: icp?.id ?? null,
      source: "manual",
      first_name: v.firstName,
      last_name: v.lastName,
      title: v.title,
      company_name: v.companyName,
      linkedin_url: v.linkedinUrl,
    })
    .select("id")
    .maybeSingle();
  if (error || !inserted) {
    return { error: "Could not add the prospect. Only workspace admins can add prospects." };
  }

  // Same gate as discovery, run out-of-band. If the trigger call fails the lead simply stays
  // "Sourced" (visible, honest) — re-adding is blocked by the dedupe, so nothing double-runs.
  try {
    await tasks.trigger(
      "qualify-lead",
      { accountId: account.id, leadId: inserted.id },
      { concurrencyKey: account.id }
    );
  } catch {
    // surfaced by the lead's Sourced status; qualification can be revisited on request
  }

  revalidatePath("/prospects");
  return { leadId: inserted.id };
}

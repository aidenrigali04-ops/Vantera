"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

export type EditState = { error?: string };

const FIELD_MAX = 120;
const NOTE_MAX = 4000;

/**
 * R6: correct a lead's identity fields (name/title/company). The corrected columns are the
 * SAME ones drafts ground on, so the fix reaches the next message automatically;
 * edited_by_user_at records that a human touched the record. RLS (leads_manage) gates
 * writes to workspace admins — the post-update select is how we detect a silent 0-row match.
 */
export async function updateLeadDetails(formData: FormData): Promise<EditState> {
  const leadId = String(formData.get("leadId") ?? "");
  const firstName = String(formData.get("firstName") ?? "").trim();
  const lastName = String(formData.get("lastName") ?? "").trim();
  const title = String(formData.get("title") ?? "").trim();
  const companyName = String(formData.get("companyName") ?? "").trim();
  if (!leadId) return { error: "Missing lead." };
  if (!firstName) return { error: "First name can't be empty." };
  if ([firstName, lastName, title, companyName].some((v) => v.length > FIELD_MAX)) {
    return { error: "Keep each field under 120 characters." };
  }

  const supabase = await createClient();
  const { data: updated, error } = await supabase
    .from("leads")
    .update({
      first_name: firstName,
      last_name: lastName || null,
      title: title || null,
      company_name: companyName || null,
      edited_by_user_at: new Date().toISOString(),
    })
    .eq("id", leadId)
    .select("id")
    .maybeSingle();
  if (error || !updated) return { error: "Could not save. Only workspace admins can edit leads." };

  revalidatePath(`/prospects/${leadId}`);
  revalidatePath("/prospects");
  return {};
}

/** R6: add a plain-text note to the lead brief (any workspace member; author + timestamp kept). */
export async function addLeadNote(formData: FormData): Promise<EditState> {
  const leadId = String(formData.get("leadId") ?? "");
  const body = String(formData.get("body") ?? "").trim();
  if (!leadId) return { error: "Missing lead." };
  if (!body) return { error: "Write the note first." };
  if (body.length > NOTE_MAX) return { error: "Notes cap at 4,000 characters." };

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Your session expired. Sign in again." };
  const { data: account } = await supabase.from("accounts").select("id").limit(1).maybeSingle();
  if (!account) return { error: "No workspace found." };

  const { error } = await supabase.from("lead_notes").insert({
    account_id: account.id,
    lead_id: leadId,
    author_user_id: user.id,
    body,
  });
  if (error) return { error: "Could not save the note. Please try again." };

  revalidatePath(`/prospects/${leadId}`);
  return {};
}

/** R6: remove a note — its author or a workspace admin (RLS enforces; 0 rows = not allowed). */
export async function deleteLeadNote(formData: FormData): Promise<EditState> {
  const noteId = String(formData.get("noteId") ?? "");
  const leadId = String(formData.get("leadId") ?? "");
  if (!noteId) return { error: "Missing note." };

  const supabase = await createClient();
  const { data: deleted, error } = await supabase
    .from("lead_notes")
    .delete()
    .eq("id", noteId)
    .select("id")
    .maybeSingle();
  if (error || !deleted) return { error: "Could not remove the note." };

  if (leadId) revalidatePath(`/prospects/${leadId}`);
  return {};
}

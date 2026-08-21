"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { validatePositioning } from "@/lib/validation";

export type PositioningState = { error?: string; saved?: boolean };

/**
 * Save the seller's positioning (0061). Account resolved from the session via an RLS-scoped select
 * (rule 02, never the form). The accounts_update policy is admin-only, so a non-admin update fails
 * at the DB and surfaces as the admin-only message.
 */
export async function updatePositioning(
  _prev: PositioningState,
  formData: FormData
): Promise<PositioningState> {
  const result = validatePositioning({
    valueProp: String(formData.get("valueProp") ?? ""),
    brandVoice: String(formData.get("brandVoice") ?? ""),
    guardrails: String(formData.get("guardrails") ?? ""),
  });
  if (!result.ok) return { error: result.error };

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Your session expired. Sign in again." };
  const { data: account } = await supabase
    .from("accounts")
    .select("id")
    .limit(1)
    .maybeSingle<{ id: string }>();
  if (!account) return { error: "Your session expired. Sign in again." };

  const { error } = await supabase
    .from("accounts")
    .update({
      value_prop: result.values.valueProp,
      brand_voice: result.values.brandVoice,
      guardrails: result.values.guardrails,
    })
    .eq("id", account.id); // RLS: admins only
  if (error) return { error: "Could not save. Only workspace admins can change positioning." };

  revalidatePath("/settings/positioning");
  return { saved: true };
}

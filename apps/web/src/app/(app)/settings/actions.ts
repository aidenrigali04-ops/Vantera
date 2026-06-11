"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { confirmAccountName, validateWorkspace } from "@/lib/validation";

export type SettingsState = { error?: string; saved?: boolean };

export async function updateProfile(
  _prev: SettingsState,
  formData: FormData
): Promise<SettingsState> {
  const displayName = String(formData.get("displayName") ?? "").trim();
  if (!displayName) return { error: "Display name can't be empty." };

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Your session expired. Sign in again." };

  const { error } = await supabase
    .from("user_profiles")
    .upsert({ user_id: user.id, display_name: displayName });
  if (error) return { error: "Could not save your profile. Please try again." };
  revalidatePath("/settings");
  return { saved: true };
}

export async function updateWorkspace(
  _prev: SettingsState,
  formData: FormData
): Promise<SettingsState> {
  const result = validateWorkspace({
    name: String(formData.get("name") ?? ""),
    industry: String(formData.get("industry") ?? ""),
    icp: String(formData.get("icp") ?? ""),
    revenueGoal: String(formData.get("revenueGoal") ?? ""),
  });
  if (!result.ok) return { error: result.error };

  const supabase = await createClient();
  const { data: account } = await supabase.from("accounts").select("id").limit(1).maybeSingle();
  if (!account) return { error: "No workspace found." };

  const { error } = await supabase
    .from("accounts")
    .update({
      name: result.values.name,
      onboarding_industry: result.values.industry,
      onboarding_icp: result.values.icp,
      revenue_goal_cents: result.values.revenueGoalCents,
    })
    .eq("id", account.id); // RLS: admins only
  if (error) return { error: "Could not save. Only workspace admins can change these settings." };
  revalidatePath("/settings");
  return { saved: true };
}

export async function requestAccountDeletion(
  _prev: SettingsState,
  formData: FormData
): Promise<SettingsState> {
  const typed = String(formData.get("confirmName") ?? "");

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Your session expired. Sign in again." };

  const { data: account } = await supabase
    .from("accounts")
    .select("id, name")
    .limit(1)
    .maybeSingle();
  if (!account) return { error: "No workspace found." };
  if (!confirmAccountName(account.name, typed)) {
    return { error: "Type the workspace name exactly to confirm." };
  }

  const { error } = await supabase
    .from("account_deletion_requests")
    .insert({ account_id: account.id, requested_by: user.id });
  if (error) return { error: "Could not request deletion. Only workspace admins can do this." };
  revalidatePath("/settings");
  return { saved: true };
}

export async function cancelAccountDeletion(
  _prev: SettingsState,
  formData: FormData
): Promise<SettingsState> {
  const requestId = String(formData.get("requestId") ?? "");
  const supabase = await createClient();

  const { error } = await supabase
    .from("account_deletion_requests")
    .update({ status: "canceled" })
    .eq("id", requestId)
    .eq("status", "pending"); // RLS scopes to the member's account; rule 02
  if (error) return { error: "Could not cancel the request." };
  revalidatePath("/settings");
  return { saved: true };
}

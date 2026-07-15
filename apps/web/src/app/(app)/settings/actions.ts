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
    avgDealValue: String(formData.get("avgDealValue") ?? ""),
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
      avg_deal_value_cents: result.values.avgDealValueCents,
    })
    .eq("id", account.id); // RLS: admins only
  if (error) return { error: "Could not save. Only workspace admins can change these settings." };
  revalidatePath("/settings");
  return { saved: true };
}

// Monday recap email opt-out (0042). One boolean, admins only via the accounts RLS
// update policy + the column grant.
export async function setWeeklySummary(
  _prev: SettingsState,
  formData: FormData
): Promise<SettingsState> {
  const next = formData.get("enabled") === "true";

  const supabase = await createClient();
  const { data: account } = await supabase.from("accounts").select("id").limit(1).maybeSingle();
  if (!account) return { error: "No workspace found." };

  const { error } = await supabase
    .from("accounts")
    .update({ weekly_summary_enabled: next })
    .eq("id", account.id); // RLS: admins only
  if (error) return { error: "Could not save. Only workspace admins can change this." };
  revalidatePath("/settings");
  return { saved: true };
}

// L3 (0051): interested-reply / meeting-booked / needs-you emails — same one-boolean idiom.
export async function setLeadEventEmails(
  _prev: SettingsState,
  formData: FormData
): Promise<SettingsState> {
  const next = formData.get("enabled") === "true";
  const supabase = await createClient();
  const { data: account } = await supabase.from("accounts").select("id").limit(1).maybeSingle();
  if (!account) return { error: "No workspace found." };
  const { error } = await supabase
    .from("accounts")
    .update({ lead_event_emails_enabled: next })
    .eq("id", account.id); // RLS: admins only
  if (error) return { error: "Could not save. Only workspace admins can change this." };
  revalidatePath("/settings");
  return { saved: true };
}

/** R5: the lifecycle-email toggle (trial-ending heads-up + payment-failure notice). */
export async function setLifecycleEmails(
  _prev: SettingsState,
  formData: FormData
): Promise<SettingsState> {
  const next = formData.get("enabled") === "true";
  const supabase = await createClient();
  const { data: account } = await supabase.from("accounts").select("id").limit(1).maybeSingle();
  if (!account) return { error: "No workspace found." };
  const { error } = await supabase
    .from("accounts")
    .update({ lifecycle_emails_enabled: next })
    .eq("id", account.id); // RLS: admins only
  if (error) return { error: "Could not save. Only workspace admins can change this." };
  revalidatePath("/settings");
  return { saved: true };
}

// P1 (2026-07-15): in-app password change — the only path used to be the forgot-password email.
export async function changePassword(
  _prev: SettingsState,
  formData: FormData
): Promise<SettingsState> {
  const password = String(formData.get("password") ?? "");
  const confirm = String(formData.get("confirm") ?? "");
  if (password.length < 8) return { error: "Password must be at least 8 characters." };
  if (password !== confirm) return { error: "Passwords don't match." };
  const supabase = await createClient();
  const { error } = await supabase.auth.updateUser({ password });
  if (error) return { error: "Could not change your password. Try again shortly." };
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

  // Stop all activity immediately so the grace window burns no platform usage: pause every live
  // agent (no new prospecting/intent runs) and freeze outreach (the scheduler holds all sends and
  // follow-up touches while outreach is paused). Best-effort — the request itself is already
  // recorded, and the deletion sweep will run regardless. Restored if the request is canceled.
  await supabase.from("agents").update({ status: "paused" }).eq("account_id", account.id).eq("status", "live");
  await supabase.from("accounts").update({ outreach_paused: true }).eq("id", account.id);

  revalidatePath("/settings");
  return { saved: true };
}

export async function cancelAccountDeletion(
  _prev: SettingsState,
  formData: FormData
): Promise<SettingsState> {
  const requestId = String(formData.get("requestId") ?? "");
  const supabase = await createClient();

  const { data: canceled, error } = await supabase
    .from("account_deletion_requests")
    .update({ status: "canceled" })
    .eq("id", requestId)
    .eq("status", "pending") // RLS scopes to the member's account; rule 02
    .select("account_id")
    .maybeSingle();
  if (error) return { error: "Could not cancel the request." };

  // Un-freeze outreach so a canceled deletion leaves a usable workspace again. Agents stay paused
  // (re-enable them deliberately from the Agents page) — we never auto-resume sourcing/sending.
  if (canceled?.account_id) {
    await supabase.from("accounts").update({ outreach_paused: false }).eq("id", canceled.account_id);
  }

  revalidatePath("/settings");
  return { saved: true };
}

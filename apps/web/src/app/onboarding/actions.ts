"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { validateOnboarding } from "@/lib/validation";

export type OnboardingState = { error?: string };

export async function completeOnboarding(
  _prev: OnboardingState,
  formData: FormData
): Promise<OnboardingState> {
  const result = validateOnboarding({
    industry: String(formData.get("industry") ?? ""),
    icp: String(formData.get("icp") ?? ""),
    revenueGoal: String(formData.get("revenueGoal") ?? ""),
  });
  if (!result.ok) return { error: result.error };

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  // first completion creates the workspace; company name was captured at signup
  let { data: account } = await supabase.from("accounts").select("id").limit(1).maybeSingle();
  if (!account) {
    const name =
      (user.user_metadata?.company_name as string | undefined)?.trim() ||
      user.email?.split("@")[0] ||
      "My workspace";
    const { data: accountId, error: rpcError } = await supabase.rpc("create_account", {
      account_name: name,
    });
    if (rpcError || !accountId) {
      return { error: "Could not create your workspace. Please try again." };
    }
    account = { id: accountId as string };
  }

  const { error } = await supabase
    .from("accounts")
    .update({
      onboarding_industry: result.values.industry,
      onboarding_icp: result.values.icp,
      revenue_goal_cents: result.values.revenueGoalCents,
      onboarding_completed_at: new Date().toISOString(),
    })
    .eq("id", account.id);
  if (error) return { error: "Could not save your answers. Please try again." };

  redirect("/dashboard");
}

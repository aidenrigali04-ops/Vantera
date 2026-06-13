"use server";

import { redirect } from "next/navigation";
import { scanWebsite, type WebsiteScan } from "@vantera/agent-brains";
import { createClient } from "@/lib/supabase/server";
import { validateOnboarding } from "@/lib/validation";

export type OnboardingState = { error?: string; scan?: WebsiteScan };

export async function completeOnboarding(
  _prev: OnboardingState,
  formData: FormData
): Promise<OnboardingState> {
  const result = validateOnboarding({
    companyName: String(formData.get("companyName") ?? ""),
    websiteUrl: String(formData.get("websiteUrl") ?? ""),
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

  // first completion creates the workspace under the company name from the wizard
  let { data: account } = await supabase.from("accounts").select("id").limit(1).maybeSingle();
  if (!account) {
    const { data: accountId, error: rpcError } = await supabase.rpc("create_account", {
      account_name: result.values.companyName,
    });
    if (rpcError || !accountId) {
      return { error: "Could not create your workspace. Please try again." };
    }
    account = { id: accountId as string };
  }

  const { error } = await supabase
    .from("accounts")
    .update({
      name: result.values.companyName,
      website_url: result.values.websiteUrl,
      onboarding_industry: result.values.industry,
      onboarding_icp: result.values.icp,
      revenue_goal_cents: result.values.revenueGoalCents,
      onboarding_completed_at: new Date().toISOString(),
    })
    .eq("id", account.id);
  if (error) return { error: "Could not save your answers. Please try again." };

  // learn the seller's offerings from their website so the Scout agent targets the
  // right leads; the result is shown to the user and cached on the account (the
  // pipeline's 30-day staleness check picks it up from here). A broken or missing
  // website never blocks onboarding — the next Scout run retries the scan.
  if (result.values.websiteUrl) {
    try {
      const scan = await scanWebsite(result.values.websiteUrl);
      const { error: scanError } = await supabase
        .from("accounts")
        .update({
          website_scan: { ...scan, url: result.values.websiteUrl },
          website_scanned_at: new Date().toISOString(),
        })
        .eq("id", account.id);
      if (!scanError) return { scan };
    } catch (err) {
      // fall through to the dashboard redirect; the Scout run retries via staleness
      console.error("onboarding website scan failed", err);
    }
  }

  redirect("/dashboard");
}

"use server";

import { redirect } from "next/navigation";
import { scanWebsite, type WebsiteScan } from "@vantera/agent-brains";
import { createClient } from "@/lib/supabase/server";
import { validateOnboarding } from "@/lib/validation";

export type OnboardingState = { error?: string; done?: boolean; scan?: WebsiteScan };

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
  // pipeline's 30-day staleness check picks it up from here). When a website was
  // given, the summary screen is the onboarding payoff, so we ALWAYS present it:
  // a successful scan shows what we learned, a failed scan still confirms setup and
  // hands the retry to the next Scout run. A broken/missing website never blocks
  // onboarding. A blank website has nothing to summarize → straight to dashboard.
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
      // even if caching the scan failed, the user still earned their summary; the
      // Scout run re-persists it via the staleness check.
      if (scanError) console.error("onboarding website scan cache write failed", scanError);
      return { done: true, scan };
    } catch (err) {
      // the scan itself failed (unreachable site, model error) — confirm setup
      // anyway and let the next Scout run retry the scan.
      console.error("onboarding website scan failed", err);
      return { done: true };
    }
  }

  redirect("/dashboard");
}

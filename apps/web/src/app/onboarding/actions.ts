"use server";

import { redirect } from "next/navigation";
import { scanWebsite, deriveIntentWatchlist, type WebsiteScan } from "@vantera/agent-brains";
import { createClient } from "@/lib/supabase/server";
import { validateOnboarding } from "@/lib/validation";
import { loadBillingRow, hasActivePlan } from "@/lib/billing/entitlement";

export type OnboardingState = { error?: string; done?: boolean; scan?: WebsiteScan };

/** Default outreach CTA — sensible out of the box, refined later in Settings → Sharpen your results. */
const DEFAULT_CTA = "a quick intro call to see if it's a fit";

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
    avgDealValue: String(formData.get("avgDealValue") ?? ""),
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
      avg_deal_value_cents: result.values.avgDealValueCents,
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

/**
 * Go live: the whole setup collapsed into one action. From the onboarding answers we already hold,
 * auto-provision the system live — Prospect (Scout) from the ICP, Outreach with a sensible default
 * CTA, and Intent with an auto-derived watchlist — no wizards, no per-agent deploys. Gated on
 * email-confirmed + active plan/trial (the consent + trial-abuse moment, rule 08). Idempotent: a
 * re-run once the system is live just lands on the dashboard. Intent is best-effort — a hiccup
 * deriving its watchlist never blocks going live.
 */
export async function goLive(_prev: OnboardingState, _formData: FormData): Promise<OnboardingState> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  if (!user.email_confirmed_at) {
    return { error: "Confirm your email to go live — check your inbox for the verification link." };
  }

  const { data: account } = await supabase
    .from("accounts")
    .select("id, onboarding_icp, onboarding_industry, website_scan")
    .limit(1)
    .maybeSingle<{
      id: string;
      onboarding_icp: string | null;
      onboarding_industry: string | null;
      website_scan: { summary?: string; offerings?: string[]; value_props?: string[] } | null;
    }>();
  if (!account) return { error: "Finish onboarding first." };

  // active plan / trial required to spend (rule 08) — fresh workspaces start on a trial
  const billingRow = await loadBillingRow(supabase);
  if (!hasActivePlan(billingRow)) redirect("/settings/billing?reason=deploy");

  // idempotent: already live → straight to the dashboard
  const { data: existingScout } = await supabase
    .from("agents")
    .select("id")
    .eq("account_id", account.id)
    .eq("kind", "scout")
    .limit(1)
    .maybeSingle<{ id: string }>();
  if (existingScout) redirect("/dashboard");

  const icpName = account.onboarding_icp?.trim();
  if (!icpName) {
    return { error: "Add your target audience in Settings, then go live." };
  }

  // ── Prospect (Scout) — sources + qualifies against the onboarding ICP ──
  const { data: icp } = await supabase
    .from("icps")
    .insert({ account_id: account.id, name: icpName, criteria: {}, source: "onboarding" })
    .select("id")
    .single<{ id: string }>();
  if (!icp) return { error: "Could not set up your system. Only workspace admins can do this." };

  const { data: scout, error: scoutErr } = await supabase
    .from("agents")
    .insert({
      account_id: account.id,
      kind: "scout",
      name: "Scout",
      status: "live",
      config: { prospects_per_run: 60, min_score: 70 },
      run_at_time: "08:00",
      cadence: "daily",
      timezone: "UTC",
      deployed_at: new Date().toISOString(),
      created_by: user.id,
    })
    .select("id")
    .single<{ id: string }>();
  if (scoutErr || !scout) {
    return { error: "Could not go live. Only workspace admins can do this." };
  }
  await supabase.from("agent_icps").insert({ agent_id: scout.id, icp_id: icp.id, account_id: account.id, position: 0 });

  // ── Outreach (Copy) — drafts on a default CTA into the review queue (refine it in Settings) ──
  const { data: campaign } = await supabase
    .from("campaigns")
    .insert({
      account_id: account.id,
      name: "Outreach (agent)",
      status: "active",
      channels: ["linkedin"],
      targeting: [{ type: "icp", value: icpName }],
      copywriting_mode: "agent",
      send_mode: "review",
      created_by: user.id,
    })
    .select("id")
    .single<{ id: string }>();
  if (campaign) {
    await supabase.from("agents").insert({
      account_id: account.id,
      kind: "copy",
      name: "Outreach",
      status: "live",
      config: { cta: DEFAULT_CTA, channels: { linkedin: true } },
      campaign_id: campaign.id,
      deployed_at: new Date().toISOString(),
      created_by: user.id,
    });
  }

  // ── Intent (best-effort) — auto-derived watchlist; no URL hunting, never blocks go-live ──
  try {
    const scan = account.website_scan;
    const offering = scan
      ? [
          scan.summary,
          scan.offerings?.length ? `Offerings: ${scan.offerings.join(", ")}` : "",
          scan.value_props?.length ? `Value props: ${scan.value_props.join("; ")}` : "",
        ]
          .filter(Boolean)
          .join(". ")
      : "";
    const watch = await deriveIntentWatchlist({
      industry: account.onboarding_industry,
      offering: offering || icpName,
      icp: icpName,
    });
    if (watch.keywords.length || watch.competitors.length || watch.hashtags.length) {
      await supabase.from("agents").insert({
        account_id: account.id,
        kind: "intent",
        name: "Intent",
        status: "live",
        config: {
          watch: {
            creators: [],
            competitors: watch.competitors,
            keywords: watch.keywords,
            hashtags: watch.hashtags.map((h) => (h.startsWith("#") ? h : `#${h}`)),
          },
          signals: { engagement: true, content: true },
          min_score: 70,
        },
        run_at_time: "08:00",
        cadence: "daily",
        timezone: "UTC",
        deployed_at: new Date().toISOString(),
        created_by: user.id,
      });
    }
  } catch (err) {
    console.error("go-live: intent provisioning failed (non-blocking)", err);
  }

  redirect("/dashboard");
}

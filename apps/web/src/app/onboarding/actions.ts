"use server";

import { redirect } from "next/navigation";
import {
  scanWebsite,
  deriveIntentWatchlist,
  matchStarterPlays,
  proposeNextChallenger,
  type WebsiteScan,
} from "@vantera/agent-brains";
import { playCards, type PlayCard } from "@/lib/plays";
import { createClient } from "@/lib/supabase/server";
import { validatePersonalize, validateConfirmation } from "@/lib/validation";
import { loadBillingRow, hasActivePlan, gate } from "@/lib/billing/entitlement";
import { createLinkedInInfraFromEnv } from "@vantera/linkedin-infra";
import { reconcileLinkedInAccounts } from "@/lib/linkedin/sync";
import { buildConnectRedirects } from "@/lib/linkedin/redirects";
import {
  countBillableLinkedInAccounts,
  hasActiveLinkedInConnection,
} from "@/lib/linkedin/connection-state";
import { recordFunnelEvent } from "@/lib/observability/funnel";

/** Default outreach CTA — sensible out of the box, refined later in Settings → Sharpen your results. */
const DEFAULT_CTA = "a quick intro call to see if it's a fit";

export type PersonalizeState = {
  error?: string;
  saved?: boolean;
  scanned?: boolean;
  /** the derived positioning, returned so the analysis tracker can pay off live */
  scan?: { headline: string; summary: string; suggested_icp: string; scope_of_industry: string };
  /** Vera's matched starter plays for the derived buyer — the proven-play payoff (Stage 0) */
  plays?: PlayCard[];
};
export type FindLeadsState = { error?: string };

async function currentAccountId(): Promise<{ id: string } | "no-user"> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return "no-user";
  const { data: account } = await supabase
    .from("accounts")
    .select("id")
    .limit(1)
    .maybeSingle<{ id: string }>();
  return account ?? { id: "" };
}

// ── Step 1: Personalize ───────────────────────────────────────────────────────
/**
 * Save the only things we can't derive (company, role, the seller's URLs), then scan the website so
 * the Confirmation step is instant on return from the LinkedIn connect redirect. Industry/ICP/goals
 * are NOT collected here — they're derived from the scan and confirmed in step 3 (B=MAP: cut fields).
 * Saving before the redirect is what lets the wizard resume at Confirmation when the user comes back.
 */
export async function savePersonalize(
  _prev: PersonalizeState,
  formData: FormData
): Promise<PersonalizeState> {
  const result = validatePersonalize({
    companyName: String(formData.get("companyName") ?? ""),
    role: String(formData.get("role") ?? ""),
    websiteUrl: String(formData.get("websiteUrl") ?? ""),
    linkedinUrl: String(formData.get("linkedinUrl") ?? ""),
  });
  if (!result.ok) return { error: result.error };

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  // first save creates the workspace under the company name
  let { data: account } = await supabase.from("accounts").select("id").limit(1).maybeSingle();
  if (!account) {
    const { data: accountId, error: rpcError } = await supabase.rpc("create_account", {
      account_name: result.values.companyName,
    });
    if (rpcError || !accountId) {
      await recordFunnelEvent("onboarding.create_workspace_failed", { userId: user.id, email: user.email, error: rpcError?.message });
      return { error: "Could not create your workspace. Please try again." };
    }
    account = { id: accountId as string };
  }

  const { error } = await supabase
    .from("accounts")
    .update({
      name: result.values.companyName,
      onboarding_role: result.values.role,
      website_url: result.values.websiteUrl,
      onboarding_linkedin_url: result.values.linkedinUrl,
    })
    .eq("id", account.id);
  if (error) {
    await recordFunnelEvent("onboarding.personalize_save_failed", { userId: user.id, accountId: account.id, error: error.message });
    return { error: "Could not save your answers. Please try again." };
  }

  // Scan the site now so the derived Confirmation is ready when they return from connecting.
  // A broken/missing site never blocks onboarding — the next Scout run retries the scan.
  if (result.values.websiteUrl) {
    try {
      const scan = await scanWebsite(result.values.websiteUrl);
      await supabase
        .from("accounts")
        .update({ website_scan: { ...scan, url: result.values.websiteUrl }, website_scanned_at: new Date().toISOString() })
        .eq("id", account.id);
      return {
        saved: true,
        scanned: true,
        scan: {
          headline: scan.headline,
          summary: scan.summary,
          suggested_icp: scan.suggested_icp,
          scope_of_industry: scan.scope_of_industry,
        },
        plays: playCards({ industry: scan.scope_of_industry, icp: scan.suggested_icp }),
      };
    } catch (err) {
      console.error("onboarding website scan failed", err);
      await recordFunnelEvent("onboarding.website_scan_failed", {
        userId: user.id,
        accountId: account.id,
        error: err,
        severity: "info", // non-blocking: the next Scout run retries the scan
      });
      return { saved: true, scanned: false };
    }
  }
  return { saved: true, scanned: false };
}

// ── Step 2: Connect LinkedIn (hosted-auth redirect back to /onboarding) ─────────
/** Hosted-auth link whose return URLs land back on /onboarding so the wizard resumes at Confirmation. */
export async function createOnboardingConnectLink(): Promise<{ url?: string; error?: string }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    await recordFunnelEvent("onboarding.connect_no_session", { severity: "info" });
    return { error: "Your session expired. Sign in again." };
  }

  const { data: account } = await supabase
    .from("accounts")
    .select("id")
    .limit(1)
    .maybeSingle<{ id: string }>();
  if (!account) {
    await recordFunnelEvent("onboarding.connect_no_account", { userId: user.id });
    return { error: "Finish the first step, then connect." };
  }

  const liCount = await countBillableLinkedInAccounts(supabase);
  const billingRow = await loadBillingRow(supabase);
  if (!billingRow) {
    await recordFunnelEvent("onboarding.connect_no_billing", { userId: user.id, accountId: account.id });
    return { error: "Start your trial in Billing first, then connect." };
  }
  const planGate = gate(billingRow, "linkedinAccount", liCount);
  if (!planGate.ok) {
    await recordFunnelEvent("onboarding.connect_plan_gate", { userId: user.id, accountId: account.id, extra: { reason: planGate.error } });
    return { error: planGate.error };
  }

  try {
    const redirects = buildConnectRedirects(process.env.APP_URL, "/onboarding");
    const { url } = await createLinkedInInfraFromEnv().createHostedAuthLink(account.id, redirects);
    // Breadcrumb: the user got a hosted-auth link and is being sent off to connect. If
    // onboarding still doesn't complete, the drop is at the hosted login / provider return —
    // NOT here. This is what tells "hit an error" apart from "abandoned at the wall".
    await recordFunnelEvent("onboarding.connect_link_issued", { userId: user.id, accountId: account.id, severity: "info" });
    return { url };
  } catch (err) {
    console.error("createOnboardingConnectLink failed:", err);
    await recordFunnelEvent("onboarding.connect_link_failed", { userId: user.id, accountId: account.id, error: err });
    return { error: "Could not generate a connection link. Try again shortly." };
  }
}

// ── Step 4: Find my first leads (save confirmed targeting + provision live system) ──
/**
 * Save the confirmed targeting + goal, then auto-provision the live system (Scout from the ICP,
 * Outreach with a default CTA, Intent with an auto-derived watchlist) and land on the dashboard,
 * where the "finding your first prospects" signal takes over. Gated on email-confirmed + active
 * plan/trial (consent + trial-abuse moment, rule 08). Idempotent: re-run once live → dashboard.
 */
export async function findFirstLeads(
  _prev: FindLeadsState,
  formData: FormData
): Promise<FindLeadsState> {
  const result = validateConfirmation({
    industry: String(formData.get("industry") ?? ""),
    icp: String(formData.get("icp") ?? ""),
    revenueGoal: String(formData.get("revenueGoal") ?? ""),
    avgDealValue: String(formData.get("avgDealValue") ?? ""),
  });
  if (!result.ok) return { error: result.error };

  // L1 meeting layer: where interested buyers book. Required unless the user takes the
  // honest escape hatch ("I don't have one yet") — then a dashboard task card nags until set.
  const bookingUrlRaw = String(formData.get("bookingUrl") ?? "").trim();
  const noBookingUrl = String(formData.get("noBookingUrl") ?? "") === "on";
  if (!noBookingUrl) {
    if (!bookingUrlRaw) return { error: "Add your booking link — or tick “I don't have one yet.”" };
    if (!/^https:\/\/\S+\.\S+/.test(bookingUrlRaw)) {
      return { error: "The booking link must be a full https:// URL." };
    }
  }
  const bookingUrl = noBookingUrl ? null : bookingUrlRaw;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  // Email-verification gate removed (P2 trap, 2026-07-15): signup auto-confirms via the
  // admin API, so this branch could only ever dead-end a user waiting for an email that is
  // never sent. Re-add only if signup switches to real email confirmation.

  const { data: account } = await supabase
    .from("accounts")
    .select("id, website_scan")
    .limit(1)
    .maybeSingle<{ id: string; website_scan: WebsiteScan | null }>();
  if (!account) return { error: "Start over — your workspace wasn't found." };

  const billingRow = await loadBillingRow(supabase);
  if (!hasActivePlan(billingRow)) {
    await recordFunnelEvent("onboarding.deploy_no_active_plan", { userId: user.id, accountId: account.id, severity: "info" });
    redirect("/settings/billing?reason=deploy");
  }

  const { error: saveErr } = await supabase
    .from("accounts")
    .update({
      onboarding_industry: result.values.industry,
      onboarding_icp: result.values.icp,
      revenue_goal_cents: result.values.revenueGoalCents,
      avg_deal_value_cents: result.values.avgDealValueCents,
      // 0061: the seller's own positioning, confirmed/edited from the scan-prefilled field.
      // Optional and lenient — a blank never blocks onboarding; editable later in Settings.
      value_prop: String(formData.get("valueProp") ?? "").trim() || null,
      onboarding_completed_at: new Date().toISOString(),
    })
    .eq("id", account.id);
  if (saveErr) {
    await recordFunnelEvent("onboarding.deploy_save_failed", { userId: user.id, accountId: account.id, error: saveErr.message });
    return { error: "Could not save your targeting. Please try again." };
  }

  // idempotent: already provisioned → straight to the dashboard
  const { data: existingScout } = await supabase
    .from("agents")
    .select("id")
    .eq("account_id", account.id)
    .eq("kind", "scout")
    .limit(1)
    .maybeSingle<{ id: string }>();
  if (existingScout) redirect("/dashboard");

  // ── Prospect (Scout) — sources + qualifies against the confirmed ICP. next_run_at left null
  //    so the scheduler treats it as DUE and the first pull starts on the next tick (~15 min). ──
  const { data: icp } = await supabase
    .from("icps")
    .insert({ account_id: account.id, name: result.values.icp, criteria: {}, source: "onboarding" })
    .select("id")
    .single<{ id: string }>();
  if (!icp) {
    await recordFunnelEvent("onboarding.deploy_provision_failed", { userId: user.id, accountId: account.id, extra: { step: "icp" } });
    return { error: "Could not set up your system. Only workspace admins can do this." };
  }

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
    await recordFunnelEvent("onboarding.deploy_provision_failed", { userId: user.id, accountId: account.id, error: scoutErr?.message, extra: { step: "scout" } });
    return { error: "Could not start. Only workspace admins can do this." };
  }
  await supabase.from("agent_icps").insert({ agent_id: scout.id, icp_id: icp.id, account_id: account.id, position: 0 });

  // ── Outreach (Copy) — drafts on a default CTA into the review queue (refine in Settings) ──
  const { data: campaign } = await supabase
    .from("campaigns")
    .insert({
      account_id: account.id,
      name: "Outreach (agent)",
      status: "active",
      channels: ["linkedin"],
      targeting: [{ type: "icp", value: result.values.icp }],
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
      config: { cta: DEFAULT_CTA, channels: { linkedin: true }, bookingUrl },
      campaign_id: campaign.id,
      deployed_at: new Date().toISOString(),
      created_by: user.id,
    });
  }

  // ── Vera's playbook (Stage 0, spec 2026-07-14) — seed the matched starter play as the
  //    champion strategy and start the first live test, so every new account runs a proven
  //    play with an experiment testing improvements from day one. Best-effort: never blocks
  //    onboarding; the one-live-experiment index makes a duplicate start a caught no-op. ──
  try {
    const [play] = matchStarterPlays({ industry: result.values.industry, icp: result.values.icp });
    if (play) {
      const { data: existingPb } = await supabase
        .from("optimization_playbook")
        .select("account_id")
        .eq("account_id", account.id)
        .maybeSingle<{ account_id: string }>();
      if (!existingPb) {
        await supabase.from("optimization_playbook").insert({
          account_id: account.id,
          champion_strategy: play.strategy,
          version: 1,
        });
      }
      const challenger = proposeNextChallenger("acceptance", play.strategy);
      if (challenger) {
        await supabase.from("optimization_experiments").insert({
          account_id: account.id,
          stage_key: "acceptance",
          champion_strategy: play.strategy,
          challenger_strategy: challenger,
          allocation_pct: 25,
          min_sample: 30,
          status: "running",
          created_by: user.id,
        });
      }
    }
  } catch (err) {
    console.error("find-first-leads: playbook seeding failed (non-blocking)", err);
  }

  // ── Intent (best-effort) — auto-derived watchlist; never blocks the first pull ──
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
      industry: result.values.industry,
      offering: offering || result.values.icp,
      icp: result.values.icp,
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
    console.error("find-first-leads: intent provisioning failed (non-blocking)", err);
  }

  // ?onboarded=1 is analytics-only: RouteEvents fires onboarding_completed on
  // landing, then strips the param. The idempotent re-run above stays plain.
  redirect("/dashboard?onboarded=1");
}

/**
 * Backstop a lagging hosted-auth status webhook so a just-connected account shows connected.
 *
 * The wizard polls this after the connect redirect returns. Without it, a single missed
 * reconcile on the return render left the user staring at "Connect your LinkedIn" with no
 * way back — refreshing drops the `?connected=1` param, so the reconcile never ran again and
 * the only apparent option was to connect a second time (minting a second billable seat).
 */
export async function syncOnboardingConnection(): Promise<{ connected: boolean }> {
  const acct = await currentAccountId();
  if (acct === "no-user" || !acct.id) return { connected: false };
  try {
    // Called only while the user waits on the connect step right after a hosted login.
    await reconcileLinkedInAccounts(acct.id, { adoptNew: true });
  } catch (err) {
    console.error("syncOnboardingConnection failed:", err);
    await recordFunnelEvent("onboarding.connect_sync_failed", {
      accountId: acct.id,
      error: err,
      severity: "info", // the status webhook is still the primary path
    });
  }
  const supabase = await createClient();
  return { connected: await hasActiveLinkedInConnection(supabase) };
}

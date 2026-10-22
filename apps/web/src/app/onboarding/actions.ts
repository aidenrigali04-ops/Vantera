"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import {
  scanWebsite,
  draftIcp,
  icpDraftIsEmpty,
  peekFavicon,
  deriveIntentWatchlist,
  matchStarterPlays,
  proposeNextChallenger,
  type IcpDraft,
  type WebsiteScan,
} from "@vantera/agent-brains";
import { createLinkedInInfraFromEnv, isLinkedInInfraConfigured } from "@vantera/linkedin-infra";
import { createClient } from "@/lib/supabase/server";
import { checkLimit } from "@/lib/rate-limit";
import { normalizeWebsiteUrl, validateOnboardingDetails } from "@/lib/validation";
import { parseBuyersForm } from "@/lib/validation/buyers";
import { maybeStartFastPass, resetRevealRun } from "@/lib/reveal/start-fast-pass";
import { billingBypassAllowed } from "./billing-bypass";
import { provisionOnboardingAgents } from "./provision";
import { accountSkipsPayment } from "@/lib/billing/founder-exempt";

export type DetailsState = { error?: string };

// ── Step 1 · Details (full name + brand + website → workspace, scan, drafted ICP) ──────────

/**
 * The only step that asks anything. Creates the workspace on first save, writes the user's
 * display name, then does the research the user would otherwise be asked about: scans the
 * site (fail-open) and drafts the ICP from it (fail-open to `{}` criteria). Idempotent —
 * re-saving updates in place; the onboarding ICP row is updated, never duplicated.
 */
export async function saveDetails(_prev: DetailsState, formData: FormData): Promise<DetailsState> {
  const result = validateOnboardingDetails({
    fullName: String(formData.get("fullName") ?? ""),
    brandName: String(formData.get("brandName") ?? ""),
    websiteUrl: String(formData.get("websiteUrl") ?? ""),
  });
  if (!result.ok) return { error: result.error };
  const { fullName, brandName, websiteUrl } = result.values;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  // first save creates the workspace under the brand name
  let { data: account } = await supabase
    .from("accounts")
    .select("id, website_url, website_scan, website_scanned_at, value_prop")
    .limit(1)
    .maybeSingle<{
      id: string;
      website_url: string | null;
      website_scan: (WebsiteScan & { url?: string }) | null;
      website_scanned_at: string | null;
      value_prop: string | null;
    }>();
  if (!account) {
    const { data: accountId, error: rpcError } = await supabase.rpc("create_account", {
      account_name: brandName,
    });
    if (rpcError || !accountId) {
      return { error: "Could not create your workspace. Please try again." };
    }
    account = {
      id: accountId as string,
      website_url: null,
      website_scan: null,
      website_scanned_at: null,
      value_prop: null,
    };
  }

  const { error: profileError } = await supabase
    .from("user_profiles")
    .upsert({ user_id: user.id, display_name: fullName });
  if (profileError) return { error: "Could not save your name. Please try again." };

  // Scan only when the URL is new — a re-save with the same site reuses the cached scan.
  let scan: WebsiteScan | null =
    account.website_scan && account.website_scan.url === websiteUrl ? account.website_scan : null;
  if (!scan) {
    try {
      scan = await scanWebsite(websiteUrl);
    } catch (err) {
      // unreadable site → continue without a scan; the next Scout run retries via the staleness check
      console.error("onboarding website scan failed", err);
      scan = null;
    }
  }

  // Draft the ICP from the scan so nobody has to answer "who do you sell to?".
  const draft = scan ? await draftIcp({ companyName: brandName, scan }) : null;
  const icpName = draft?.name || "Ideal buyers";
  const criteria =
    draft && !icpDraftIsEmpty(draft)
      ? {
          titles: draft.titles,
          industries: draft.industries,
          companySizes: draft.companySizes,
          geos: draft.geos,
          // extra key rides the jsonb: the rules gate ignores it; rank context includes it
          signals: draft.signals,
        }
      : {};

  const { error } = await supabase
    .from("accounts")
    .update({
      name: brandName,
      website_url: websiteUrl,
      onboarding_icp: icpName,
      onboarding_industry: draft?.industries[0] ?? scan?.scope_of_industry?.slice(0, 120) ?? null,
      ...(scan
        ? {
            website_scan: { ...scan, url: websiteUrl },
            website_scanned_at: new Date().toISOString(),
            // 0061: the seller's own positioning. Prefilled from the scan; editable later in
            // Settings → Positioning. Never overwrites a value they already edited.
            ...(account.value_prop ? {} : { value_prop: scan.summary.slice(0, 600) }),
          }
        : {}),
    })
    .eq("id", account.id);
  if (error) return { error: "Could not save your details. Please try again." };

  // Idempotent: update the existing onboarding ICP instead of duplicating.
  const { data: existingIcp } = await supabase
    .from("icps")
    .select("id")
    .eq("account_id", account.id)
    .eq("source", "onboarding")
    .limit(1)
    .maybeSingle<{ id: string }>();
  const icpWrite = existingIcp
    ? supabase.from("icps").update({ name: icpName, criteria }).eq("id", existingIcp.id)
    : supabase.from("icps").insert({ account_id: account.id, name: icpName, criteria, source: "onboarding" });
  const { error: icpError } = await icpWrite;
  if (icpError) console.error("onboarding icp write failed (non-blocking)", icpError);

  redirect("/onboarding");
}

// ── Step 2 · Your buyers (the drafted ICP, confirmed or edited → agents + preview) ─────────

/**
 * Confirm (or correct) the ICP `saveDetails` drafted: write it back to the onboarding `icps`
 * row, provision the Scout + Outreach agents on it, store the exclusions/guidance on the
 * Scout (`agents.config.targeting`), stamp the milestone once, and start the lead preview.
 * Idempotent — re-confirming updates in place.
 */
export async function confirmBuyers(_prev: DetailsState, formData: FormData): Promise<DetailsState> {
  const parsed = parseBuyersForm(formData);
  if (!parsed.ok) return { error: parsed.error };
  const { name, criteria, targeting } = parsed.values;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: account } = await supabase
    .from("accounts")
    .select("id, buyers_confirmed_at")
    .limit(1)
    .maybeSingle<{ id: string; buyers_confirmed_at: string | null }>();
  if (!account) redirect("/onboarding");

  const { data: icp } = await supabase
    .from("icps")
    .select("id")
    .eq("account_id", account.id)
    .eq("source", "onboarding")
    .limit(1)
    .maybeSingle<{ id: string }>();
  if (!icp) return { error: "Save your details first." };

  const { error: icpError } = await supabase.from("icps").update({ name, criteria }).eq("id", icp.id);
  if (icpError) return { error: "Could not save your buyers. Please try again." };

  const { error: accountError } = await supabase
    .from("accounts")
    .update({ onboarding_icp: name })
    .eq("id", account.id);
  if (accountError) return { error: "Could not save your buyers. Please try again." };

  let scoutId: string;
  try {
    ({ scoutId } = await provisionOnboardingAgents({
      supabase,
      accountId: account.id,
      userId: user.id,
      icp: { id: icp.id, name },
    }));
  } catch {
    return { error: "Could not set up your agents. Only workspace admins can do this." };
  }

  const { data: scout } = await supabase
    .from("agents")
    .select("config")
    .eq("id", scoutId)
    .maybeSingle<{ config: Record<string, unknown> | null }>();
  const { error: targetingError } = await supabase
    .from("agents")
    .update({ config: { ...(scout?.config ?? {}), targeting } })
    .eq("id", scoutId);
  if (targetingError) return { error: "Could not save your exclusions. Please try again." };

  if (!account.buyers_confirmed_at) {
    const { error: stampError } = await supabase
      .from("accounts")
      .update({ buyers_confirmed_at: new Date().toISOString() })
      .eq("id", account.id)
      .is("buyers_confirmed_at", null);
    if (stampError) return { error: "Could not save your buyers. Please try again." };
  }

  try {
    await maybeStartFastPass(account.id);
  } catch (err) {
    // the preview is a bonus beat; the prospects step retries it — never block confirming
    console.error("confirmBuyers: fast pass failed to start (non-blocking)", err);
  }

  redirect("/onboarding?done=buyers");
}

/**
 * Redraft the buyer profile from the saved website scan (the "that's not us" escape hatch).
 * Overwrites the onboarding ICP's name + criteria and clears any preview built on the old one.
 */
export async function regenerateBuyers(): Promise<{ error?: string }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Your session expired. Sign in again." };

  const { data: account } = await supabase
    .from("accounts")
    .select("id, name, website_scan")
    .limit(1)
    .maybeSingle<{ id: string; name: string | null; website_scan: WebsiteScan | null }>();
  if (!account) return { error: "Save your details first." };
  if (!account.website_scan) {
    return { error: "We couldn't read your site, so there's nothing to redraft from — edit the profile directly." };
  }

  let draft: IcpDraft;
  try {
    draft = await draftIcp({ companyName: account.name, scan: account.website_scan });
  } catch (err) {
    console.error("regenerateBuyers: draft failed", err);
    return { error: "Could not redraft right now. Try again shortly." };
  }
  if (icpDraftIsEmpty(draft)) {
    return { error: "Your site didn't give us enough to redraft — edit the profile directly." };
  }

  const { error } = await supabase
    .from("icps")
    .update({
      name: draft.name || "Ideal buyers",
      criteria: {
        titles: draft.titles,
        industries: draft.industries,
        companySizes: draft.companySizes,
        geos: draft.geos,
        signals: draft.signals,
      },
    })
    .eq("account_id", account.id)
    .eq("source", "onboarding");
  if (error) return { error: "Could not save the new draft. Please try again." };

  try {
    await resetRevealRun(account.id);
  } catch (err) {
    console.error("regenerateBuyers: reveal reset failed", err);
    return { error: "Saved the new draft, but couldn't refresh your preview. Try again." };
  }

  revalidatePath("/onboarding");
  return {};
}

/**
 * Live favicon preview for step 1 — the "we already did our research" beat. Guarded fetch
 * of the first 64 KB only; rate-limited per user; null on anything unusual.
 */
export async function peekFaviconAction(rawUrl: string): Promise<{ faviconUrl: string | null }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { faviconUrl: null };
  const limit = await checkLimit("faviconPeek", user.id);
  if (!limit.success) return { faviconUrl: null };
  const normalized = normalizeWebsiteUrl(String(rawUrl ?? "").slice(0, 300));
  if (!normalized.ok || !normalized.url) return { faviconUrl: null };
  return { faviconUrl: await peekFavicon(normalized.url) };
}

// ── Step 2 · LinkedIn connect ─────────────────────────────────────────────────────────────

/**
 * Hosted-auth link for onboarding — capped at ONE sender before the workspace is live
 * (plan limits govern more after). Redirects return to /onboarding, which reconciles on
 * ?connected=1 and moves to the subscription step.
 */
export async function createOnboardingConnectLink(): Promise<{ url?: string; error?: string }> {
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
  if (!account) return { error: "Save your details first." };

  const { count: liCount } = await supabase
    .from("linkedin_accounts")
    .select("id", { count: "exact", head: true })
    .eq("account_id", account.id);
  if ((liCount ?? 0) >= 1) {
    return { error: "Your LinkedIn account is already connected — continue to the next step." };
  }

  // Local dev with no provider keys: say so, instead of a generic "try again" that hides the
  // real cause. Production keeps the generic message (the env is required there).
  if (process.env.NODE_ENV === "development" && !isLinkedInInfraConfigured()) {
    return {
      error:
        "LinkedIn isn't configured in this local environment — fill the LinkedIn section of .env.example into apps/web/.env.local and restart the dev server.",
    };
  }

  try {
    // Canonical https for the registered return URLs (mirrors the webhook URL fix); local
    // dev keeps http, since https://localhost would just fail.
    const raw = (process.env.APP_URL ?? "http://localhost:3000").replace(/\/+$/, "");
    const base = /^http:\/\/(localhost|127\.0\.0\.1)(:|$)/i.test(raw) ? raw : raw.replace(/^http:\/\//i, "https://");
    const { url } = await createLinkedInInfraFromEnv().createHostedAuthLink(account.id, {
      success: `${base}/onboarding?connected=1`,
      failure: `${base}/onboarding?connected=failed`,
    });
    return { url };
  } catch (err) {
    console.error("createOnboardingConnectLink failed:", err);
    return { error: "Could not open the LinkedIn connection right now. Try again shortly." };
  }
}

// ── Step 3 · Subscription → finish (provision + complete) ─────────────────────────────────

/**
 * The last mile, run once the Stripe webhook has attached a subscription: provision the
 * Prospect (Scout) agent on the drafted ICP, the internal campaign + Outreach agent
 * (`send_mode:'review'` pinned — nothing sends without approval), a best-effort Intent
 * agent, then stamp onboarding complete. Idempotent: every insert checks for its row first,
 * so a retry after a partial failure just fills in what's missing.
 */
export async function finishOnboarding(): Promise<{ error?: string } | never> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: account } = await supabase
    .from("accounts")
    .select(
      "id, onboarding_icp, onboarding_industry, website_scan, value_prop, brand_voice, stripe_subscription_id, onboarding_completed_at"
    )
    .limit(1)
    .maybeSingle<{
      id: string;
      onboarding_icp: string | null;
      onboarding_industry: string | null;
      website_scan: { summary?: string; offerings?: string[]; value_props?: string[] } | null;
      value_prop: string | null;
      brand_voice: string | null;
      stripe_subscription_id: string | null;
      onboarding_completed_at: string | null;
    }>();
  if (!account) redirect("/onboarding");
  if (account.onboarding_completed_at) redirect("/dashboard");

  // Card required, except the founder workspace and a local environment with no billing keys.
  const skipsPayment = await accountSkipsPayment(supabase, account.id);
  if (!account.stripe_subscription_id && !billingBypassAllowed() && !skipsPayment) {
    return { error: "Choose a plan to finish setup." };
  }

  const { data: icp } = await supabase
    .from("icps")
    .select("id, name")
    .eq("account_id", account.id)
    .eq("source", "onboarding")
    .limit(1)
    .maybeSingle<{ id: string; name: string }>();
  if (!icp) return { error: "Save your details first." };

  const existing = async (kind: "intent") =>
    (
      await supabase
        .from("agents")
        .select("id")
        .eq("account_id", account.id)
        .eq("kind", kind)
        .limit(1)
        .maybeSingle<{ id: string }>()
    ).data;

  // ── Prospect (Scout) + internal campaign + Outreach (Copy) agent ──
  try {
    await provisionOnboardingAgents({ supabase, accountId: account.id, userId: user.id, icp });
  } catch {
    return { error: "Could not finish setup. Only workspace admins can do this." };
  }

  // ── Intent (best-effort) — auto-derived watchlist; never blocks finishing ──
  if (!(await existing("intent"))) {
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
        offering: offering || account.value_prop || icp.name,
        offerings: scan?.offerings,
        valueProp: account.value_prop || scan?.value_props?.[0],
        brand: account.brand_voice,
        icp: icp.name,
        icpNames: [icp.name],
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
      console.error("onboarding: intent provisioning failed (non-blocking)", err);
    }
  }

  // ── Vera's playbook (Stage 0) — seed the matched starter play as the champion strategy and
  //    start the first live test. Best-effort: never blocks finishing; the one-live-experiment
  //    index makes a duplicate start a caught no-op. ──
  try {
    const [play] = matchStarterPlays({ industry: account.onboarding_industry ?? "", icp: icp.name });
    if (play) {
      const { data: existingPb } = await supabase
        .from("optimization_playbook")
        .select("account_id")
        .eq("account_id", account.id)
        .maybeSingle<{ account_id: string }>();
      if (!existingPb) {
        await supabase
          .from("optimization_playbook")
          .insert({ account_id: account.id, champion_strategy: play.strategy, version: 1 });
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
    console.error("onboarding: playbook seeding failed (non-blocking)", err);
  }

  const { error } = await supabase
    .from("accounts")
    .update({ onboarding_completed_at: new Date().toISOString() })
    .eq("id", account.id);
  if (error) return { error: "Could not finish setup. Please try again." };

  redirect("/dashboard");
}

/** Form-action wrapper for the dev-only finish button (form actions must return void). */
export async function finishOnboardingForm(): Promise<void> {
  const res = await finishOnboarding();
  if (res?.error) redirect(`/onboarding?finish=failed`);
}

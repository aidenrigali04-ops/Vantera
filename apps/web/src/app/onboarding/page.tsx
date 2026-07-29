import { redirect } from "next/navigation";
import type { WebsiteScan } from "@vantera/agent-brains";
import { createClient } from "@/lib/supabase/server";
import { reconcileLinkedInAccounts } from "@/lib/linkedin/sync";
import { playCards } from "@/lib/plays";
import { Wizard, type WizardInit } from "./wizard";

type AccountRow = {
  id: string;
  name: string | null;
  onboarding_role: string | null;
  onboarding_linkedin_url: string | null;
  website_url: string | null;
  website_scan: WebsiteScan | null;
  onboarding_industry: string | null;
  onboarding_icp: string | null;
  revenue_goal_cents: number | null;
  avg_deal_value_cents: number | null;
  value_prop: string | null;
  onboarding_completed_at: string | null;
};

const centsToDollars = (c: number | null) => (c == null ? "" : String(Math.round(c / 100)));

export default async function OnboardingPage({
  searchParams,
}: {
  searchParams: Promise<{ connected?: string }>;
}) {
  const { connected: connectedParam } = await searchParams;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const metaCompany = (user?.user_metadata?.company_name as string | undefined)?.trim() ?? "";
  // URL the visitor typed on the landing page (carried via signup) — pre-fills the
  // website field so the site scan runs without them re-typing it.
  const metaSite = (user?.user_metadata?.pending_site as string | undefined)?.trim() ?? "";

  const { data: account } = await supabase
    .from("accounts")
    .select(
      "id, name, onboarding_role, onboarding_linkedin_url, website_url, website_scan, onboarding_industry, onboarding_icp, revenue_goal_cents, avg_deal_value_cents, value_prop, onboarding_completed_at"
    )
    .limit(1)
    .maybeSingle<AccountRow>();

  // Already finished onboarding → the dashboard owns the first-run experience.
  if (account?.onboarding_completed_at) redirect("/dashboard");

  // Returning from the hosted-auth redirect: backstop a lagging status webhook so the
  // just-connected account reads as connected and we can advance to Confirmation.
  if (connectedParam === "1" && account?.id) {
    try {
      await reconcileLinkedInAccounts(account.id);
    } catch {
      /* best-effort — the channels sync also backstops this */
    }
  }

  const { data: li } = await supabase
    .from("linkedin_accounts")
    .select("status")
    .limit(1)
    .maybeSingle<{ status: string }>();
  const connected = li?.status === "active";

  const personalizeDone = Boolean(account?.onboarding_role);
  const initialStep = !personalizeDone ? 0 : !connected ? 1 : 2;
  const scan = account?.website_scan ?? null;

  // Confirmation values: prefer what they already saved, else the derived suggestions from the scan.
  const industry = account?.onboarding_industry ?? scan?.scope_of_industry ?? "";
  const icp = account?.onboarding_icp ?? scan?.suggested_icp ?? "";

  const init: WizardInit = {
    initialStep,
    connected,
    connectFailed: connectedParam === "failed",
    scan: scan ? { headline: scan.headline ?? "", summary: scan.summary ?? "" } : null,
    // Vera's matched starter plays for this buyer (server-computed, honest source labels).
    plays: playCards({ industry, icp }),
    values: {
      companyName: account?.name ?? metaCompany,
      role: account?.onboarding_role ?? "",
      websiteUrl: account?.website_url ?? metaSite,
      linkedinUrl: account?.onboarding_linkedin_url ?? "",
      industry,
      icp,
      revenueGoal: centsToDollars(account?.revenue_goal_cents ?? null),
      avgDealValue: centsToDollars(account?.avg_deal_value_cents ?? null),
      valueProp: account?.value_prop ?? scan?.summary ?? "",
      bookingUrl: "",
    },
  };

  return <Wizard init={init} />;
}

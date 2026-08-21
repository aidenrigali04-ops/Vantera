import { createClient } from "@/lib/supabase/server";
import type { StartContext } from "./start-gate";

/**
 * Context builder for the /start journey gate — additive sibling of getGateData
 * (context.ts stays untouched). One RLS-scoped read per signal; rule 02: the account
 * is always resolved from the session, never from client input.
 */
export async function getStartContext(): Promise<StartContext & { accountId: string | null }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return {
      isAuthenticated: false,
      hasAccount: false,
      businessConfirmed: false,
      icpConfirmed: false,
      linkedinConnected: false,
      onboardingComplete: false,
      accountId: null,
    };
  }

  const { data: account } = await supabase
    .from("accounts")
    .select("id, website_url, website_scan, onboarding_completed_at")
    .limit(1)
    .maybeSingle<{
      id: string;
      website_url: string | null;
      website_scan: unknown;
      onboarding_completed_at: string | null;
    }>();

  if (!account) {
    return {
      isAuthenticated: true,
      hasAccount: false,
      businessConfirmed: false,
      icpConfirmed: false,
      linkedinConnected: false,
      onboardingComplete: false,
      accountId: null,
    };
  }

  const [{ data: icp }, { data: li }] = await Promise.all([
    supabase
      .from("icps")
      .select("id")
      .eq("account_id", account.id)
      .eq("source", "onboarding")
      .limit(1)
      .maybeSingle<{ id: string }>(),
    supabase
      .from("linkedin_accounts")
      .select("id")
      .eq("account_id", account.id)
      .in("status", ["connecting", "active"])
      .limit(1)
      .maybeSingle<{ id: string }>(),
  ]);

  return {
    isAuthenticated: true,
    hasAccount: true,
    businessConfirmed: account.website_url != null || account.website_scan != null,
    icpConfirmed: icp != null,
    linkedinConnected: li != null,
    onboardingComplete: account.onboarding_completed_at != null,
    accountId: account.id,
  };
}

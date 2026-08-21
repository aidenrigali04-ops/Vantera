import { createClient } from "@/lib/supabase/server";
import type { OnboardingContext } from "./onboarding-gate";

export type OnboardingPrefill = {
  /** user_profiles.display_name, else blank */
  fullName: string;
  /** accounts.name, else the brand typed at signup (user_metadata.company_name) */
  brandName: string;
  /** accounts.website_url, else the URL typed into the landing hero (user_metadata.website_url) */
  websiteUrl: string;
  /** favicon discovered by the website scan, when one ran */
  faviconUrl: string | null;
  email: string | null;
};

export type OnboardingData = OnboardingContext & {
  userId: string | null;
  accountId: string | null;
  prefill: OnboardingPrefill;
};

const EMPTY_PREFILL: OnboardingPrefill = {
  fullName: "",
  brandName: "",
  websiteUrl: "",
  faviconUrl: null,
  email: null,
};

/**
 * Everything the onboarding page needs in one RLS-scoped read per signal (rule 02: the
 * account always comes from the session, never from client input). Prefill falls back
 * to the signup metadata so step 1 arrives already filled in.
 */
export async function getOnboardingData(): Promise<OnboardingData> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return {
      userId: null,
      accountId: null,
      hasAccount: false,
      detailsConfirmed: false,
      linkedinConnected: false,
      subscribed: false,
      onboardingComplete: false,
      prefill: EMPTY_PREFILL,
    };
  }

  // `website_url` is what our signup writes; `pending_site` is the key the earlier signup
  // used for the same landing-page URL — honor both so no existing account loses its prefill.
  const meta = (user.user_metadata ?? {}) as {
    company_name?: string;
    website_url?: string;
    pending_site?: string;
  };

  const [{ data: account }, { data: profile }] = await Promise.all([
    supabase
      .from("accounts")
      .select("id, name, website_url, website_scan, stripe_subscription_id, onboarding_completed_at")
      .limit(1)
      .maybeSingle<{
        id: string;
        name: string;
        website_url: string | null;
        website_scan: { faviconUrl?: string } | null;
        stripe_subscription_id: string | null;
        onboarding_completed_at: string | null;
      }>(),
    supabase
      .from("user_profiles")
      .select("display_name")
      .eq("user_id", user.id)
      .maybeSingle<{ display_name: string | null }>(),
  ]);

  const prefill: OnboardingPrefill = {
    fullName: profile?.display_name?.trim() ?? "",
    brandName: account?.name?.trim() || meta.company_name?.trim() || "",
    websiteUrl: account?.website_url ?? meta.website_url ?? meta.pending_site ?? "",
    faviconUrl: account?.website_scan?.faviconUrl ?? null,
    email: user.email ?? null,
  };

  if (!account) {
    return {
      userId: user.id,
      accountId: null,
      hasAccount: false,
      detailsConfirmed: false,
      linkedinConnected: false,
      subscribed: false,
      onboardingComplete: false,
      prefill,
    };
  }

  const { data: li } = await supabase
    .from("linkedin_accounts")
    .select("id")
    .eq("account_id", account.id)
    .in("status", ["connecting", "active"])
    .limit(1)
    .maybeSingle<{ id: string }>();

  return {
    userId: user.id,
    accountId: account.id,
    hasAccount: true,
    detailsConfirmed: Boolean(account.website_url && profile?.display_name?.trim()),
    linkedinConnected: li != null,
    subscribed: account.stripe_subscription_id != null,
    onboardingComplete: account.onboarding_completed_at != null,
    prefill,
  };
}

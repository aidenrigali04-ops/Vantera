import { createClient } from "@/lib/supabase/server";

export type AccountRow = {
  id: string;
  name: string;
  onboarding_industry: string | null;
  onboarding_icp: string | null;
  revenue_goal_cents: number | null;
  onboarding_completed_at: string | null;
};

export type GateData = {
  user: { id: string; email: string | null; companyName: string | null } | null;
  account: AccountRow | null;
};

/** Session-derived identity + first account (RLS scopes the query). Rule 02: never trust client account ids. */
export async function getGateData(): Promise<GateData> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { user: null, account: null };

  const { data: account } = await supabase
    .from("accounts")
    .select("id, name, onboarding_industry, onboarding_icp, revenue_goal_cents, onboarding_completed_at")
    .limit(1)
    .maybeSingle<AccountRow>();

  return {
    user: {
      id: user.id,
      email: user.email ?? null,
      companyName: (user.user_metadata?.company_name as string | undefined) ?? null,
    },
    account: account ?? null,
  };
}

export function toGateContext(data: GateData) {
  return {
    isAuthenticated: data.user !== null,
    hasAccount: data.account !== null,
    onboardingComplete: data.account?.onboarding_completed_at != null,
  };
}

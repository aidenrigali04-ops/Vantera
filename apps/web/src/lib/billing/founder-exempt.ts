import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * The founder workspace is an admin account with no plan or payment constraints.
 * The email is the session user from Supabase Auth. A request body cannot grant this.
 * Membership role does not turn it off.
 */
export const FOUNDER_BILLING_EMAIL = "aiden@vanterasystem.com";

export function isFounderBillingExempt(
  email: string | null | undefined,
  _role?: string | null,
): boolean {
  return (email ?? "").trim().toLowerCase() === FOUNDER_BILLING_EMAIL;
}

/** True when this session's account is the founder workspace and has no card to collect. */
export async function accountSkipsPayment(supabase: SupabaseClient, accountId: string): Promise<boolean> {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return false;
  const { data: member } = await supabase
    .from("account_members")
    .select("role")
    .eq("account_id", accountId)
    .eq("user_id", user.id)
    .maybeSingle<{ role: string }>();
  return isFounderBillingExempt(user.email, member?.role);
}

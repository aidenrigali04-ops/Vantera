import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * Statuses that occupy a connection slot on the plan.
 *
 * A 'disconnected' row is a dead seat: it holds no provider connection, so counting it
 * blocked users from connecting with a "you've reached your plan limit" message that had
 * nothing to do with their plan.
 */
const BILLABLE_STATUSES = ["connecting", "active", "restricted"] as const;

/**
 * Whether the tenant has a live LinkedIn connection.
 *
 * Asks for an ACTIVE row specifically. Reading "some row, whichever the database returns
 * first" meant a tenant with both a dead and a live sender — routine on a multi-sender
 * plan — got a coin flip on whether the app thought they were connected.
 *
 * RLS scopes this to the caller's tenant; never pass an account id from client input.
 */
export async function hasActiveLinkedInConnection(supabase: SupabaseClient): Promise<boolean> {
  const { data } = await supabase
    .from("linkedin_accounts")
    .select("id")
    .eq("status", "active")
    .limit(1)
    .maybeSingle<{ id: string }>();
  return Boolean(data);
}

/** How many connection slots the tenant is currently using, for the plan gate. */
export async function countBillableLinkedInAccounts(supabase: SupabaseClient): Promise<number> {
  const { count } = await supabase
    .from("linkedin_accounts")
    .select("id", { count: "exact", head: true })
    .in("status", BILLABLE_STATUSES as unknown as string[]);
  return count ?? 0;
}

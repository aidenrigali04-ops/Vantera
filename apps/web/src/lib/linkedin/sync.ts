import "server-only";
import { createLinkedInInfraFromEnv, type ConnectedAccount } from "@vantera/linkedin-infra";
import { createServiceClient } from "@/lib/supabase/service";

/**
 * Reconcile the provider's connected LinkedIn accounts into `linkedin_accounts`
 * for `accountId`. This is the webhook-independent fallback so a connected
 * account shows up even when the hosted-auth `account_status` webhook is missed
 * (e.g. immediately on return from the connect flow) — it is never the primary
 * attribution path, just a reliable backstop.
 *
 * Multi-tenant safety: a provider account already owned by a *different* tenant
 * is never re-claimed. Existing rows keep their `connected_at` so a routine sync
 * never resets the rule-04 ramp clock; only `status`/profile fields refresh.
 *
 * `accountId` MUST be resolved from the caller's session (RLS) — never passed
 * from client input.
 */
export async function reconcileLinkedInAccounts(
  accountId: string
): Promise<{ synced: number }> {
  const accounts: ConnectedAccount[] = await createLinkedInInfraFromEnv().listAccounts();
  if (accounts.length === 0) return { synced: 0 };

  const svc = createServiceClient();
  let synced = 0;
  for (const a of accounts) {
    const { data: existing } = await svc
      .from("linkedin_accounts")
      .select("id, account_id")
      .eq("provider_ref", a.providerRef)
      .limit(1)
      .maybeSingle<{ id: string; account_id: string }>();

    // Owned by another tenant — never steal it.
    if (existing && existing.account_id !== accountId) continue;

    if (existing) {
      const { error } = await svc
        .from("linkedin_accounts")
        .update({
          status: a.status,
          profile_url: a.profileUrl,
          display_name: a.displayName,
          updated_at: new Date().toISOString(),
        })
        .eq("id", existing.id);
      if (!error) synced++;
    } else {
      const { error } = await svc.from("linkedin_accounts").insert({
        account_id: accountId,
        provider_ref: a.providerRef,
        profile_url: a.profileUrl,
        display_name: a.displayName,
        status: a.status,
        connected_at: a.status === "active" ? new Date().toISOString() : null,
      });
      if (!error) synced++;
    }
  }
  return { synced };
}

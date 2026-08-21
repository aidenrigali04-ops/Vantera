import "server-only";
import { createLinkedInInfraFromEnv, type ConnectedAccount } from "@vantera/linkedin-infra";
import { createServiceClient } from "@/lib/supabase/service";
import { planClaimsAnything, planReconcile, type ExistingRow } from "./reconcile-plan";

export interface ReconcileResult {
  /** Rows inserted or refreshed for this tenant. */
  synced: number;
  /** True when this tenant now holds at least one identity from this pass. */
  claimed: boolean;
  /**
   * Why nothing was claimed, when nothing was. `null` on success. Never rendered raw to a
   * user in production — the caller decides what to show.
   */
  failure: string | null;
}

/**
 * Reconcile the provider's connected LinkedIn identities into `linkedin_accounts` for
 * `accountId`. This is the webhook-independent fallback so a connected account shows up
 * even when the hosted-auth `account_status` webhook is missed (e.g. immediately on return
 * from the connect flow) — it is never the primary attribution path, just a backstop.
 *
 * Multi-tenant safety: the provider workspace is SHARED across tenants, so `listAccounts()`
 * returns other customers' identities. Two rules keep them apart, both enforced in the
 * tested planner (`reconcile-plan.ts`):
 *   1. an identity already owned by a different tenant is never re-claimed, and
 *   2. `providerRef` scopes a post-connect reconcile to the ONE identity the redirect named,
 *      so a single pass can't sweep every unowned identity in the workspace into this tenant.
 * The ownership read requires cross-tenant visibility, which is why this path uses the
 * service role and not the session client — an RLS-scoped read cannot see rule 1's evidence,
 * and `linkedin_accounts` is unique on (account_id, provider_ref), not provider_ref alone.
 *
 * `accountId` MUST be resolved from the caller's session (RLS) — never from client input.
 * Failures are REPORTED, not swallowed: a silent no-op here strands the user on the connect
 * step with nothing to act on.
 */
export async function reconcileLinkedInAccounts(
  accountId: string,
  options: { providerRef?: string | null } = {}
): Promise<ReconcileResult> {
  let accounts: ConnectedAccount[];
  try {
    accounts = await createLinkedInInfraFromEnv().listAccounts();
  } catch (err) {
    console.error("reconcileLinkedInAccounts: provider list failed", err);
    return { synced: 0, claimed: false, failure: describe(err) };
  }
  if (accounts.length === 0) {
    return { synced: 0, claimed: false, failure: "the provider reports no connected accounts" };
  }

  let svc: ReturnType<typeof createServiceClient>;
  try {
    svc = createServiceClient();
  } catch (err) {
    console.error("reconcileLinkedInAccounts: service client unavailable", err);
    return { synced: 0, claimed: false, failure: describe(err) };
  }

  const refs = accounts.map((a) => a.providerRef);
  const { data: rows, error: readError } = await svc
    .from("linkedin_accounts")
    .select("id, account_id, provider_ref")
    .in("provider_ref", refs);
  if (readError) {
    // Most often an invalid/placeholder service-role key. Previously this returned
    // `{synced: 0}` indistinguishable from "nothing to do" and the user saw no explanation.
    console.error("reconcileLinkedInAccounts: ownership read failed", readError);
    return { synced: 0, claimed: false, failure: readError.message };
  }

  const existingRows: ExistingRow[] = (rows ?? []).map((r) => ({
    id: r.id as string,
    accountId: r.account_id as string,
    providerRef: r.provider_ref as string,
  }));

  const plan = planReconcile({
    accountId,
    providerAccounts: accounts,
    existingRows,
    providerRef: options.providerRef,
  });

  let synced = 0;
  let lastError: string | null = null;
  for (const action of plan) {
    if (action.kind === "skip") continue;
    const a = action.account;
    if (action.kind === "update") {
      const { error } = await svc
        .from("linkedin_accounts")
        .update({
          status: a.status,
          profile_url: a.profileUrl,
          display_name: a.displayName,
          updated_at: new Date().toISOString(),
        })
        .eq("id", action.rowId);
      if (error) {
        console.error("reconcileLinkedInAccounts: update failed", error);
        lastError = error.message;
      } else synced++;
    } else {
      const { error } = await svc.from("linkedin_accounts").insert({
        account_id: accountId,
        provider_ref: a.providerRef,
        profile_url: a.profileUrl,
        display_name: a.displayName,
        status: a.status,
        connected_at: a.status === "active" ? new Date().toISOString() : null,
      });
      if (error) {
        console.error("reconcileLinkedInAccounts: insert failed", error);
        lastError = error.message;
      } else synced++;
    }
  }

  if (synced > 0) return { synced, claimed: true, failure: null };
  return {
    synced: 0,
    claimed: false,
    failure:
      lastError ??
      (planClaimsAnything(plan)
        ? "the connection could not be saved"
        : "that LinkedIn account is already linked to another workspace"),
  };
}

function describe(err: unknown): string {
  return err instanceof Error ? err.message : String(err);
}

import "server-only";
import { createLinkedInInfraFromEnv, type ConnectedAccount } from "@vantera/linkedin-infra";
import { TRIAL_DAYS } from "@vantera/billing";
import { createServiceClient } from "@/lib/supabase/service";
import { planClaimsAnything, planReconcile, type ExistingRow } from "./reconcile-plan";

export interface ReconcileResult {
  /** Rows inserted, refreshed, or revived for this tenant. */
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
 * The tenancy rules (never claim another tenant's ref OR profile; revive our own row on a
 * reconnect instead of inserting a twin; scope a post-connect pass to the one ref the
 * redirect named) live in the tested planner — `reconcile-plan.ts`. This file only reads,
 * executes, and reports. The ownership read needs cross-tenant visibility, which is why it
 * uses the service role: an RLS-scoped read cannot see the evidence the rules depend on, and
 * `linkedin_accounts` is unique on (account_id, provider_ref), not provider_ref alone.
 *
 * `accountId` MUST be resolved from the caller's session (RLS) — never from client input.
 * Failures are REPORTED, not swallowed: a silent no-op here strands the user on the connect
 * step with nothing to act on.
 */
export async function reconcileLinkedInAccounts(
  accountId: string,
  options: { providerRef?: string | null } = {}
): Promise<ReconcileResult> {
  let infra: ReturnType<typeof createLinkedInInfraFromEnv>;
  let accounts: ConnectedAccount[];
  try {
    infra = createLinkedInInfraFromEnv();
    accounts = await infra.listAccounts();
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

  // Every row, not just ref matches: the profile-identity rule needs to see rows whose ref
  // differs from the provider's (a reconnect under a fresh seat).
  const { data: rows, error: readError } = await svc
    .from("linkedin_accounts")
    .select("id, account_id, provider_ref, profile_url");
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
    profileUrl: (r.profile_url as string | null) ?? null,
  }));

  const plan = planReconcile({
    accountId,
    providerAccounts: accounts,
    existingRows,
    providerRef: options.providerRef,
  });

  let synced = 0;
  let lastError: string | null = null;
  const now = () => new Date().toISOString();

  for (const action of plan) {
    if (action.kind === "skip") continue;
    const a = action.account;

    if (action.kind === "update") {
      // Routine refresh of a row we already hold; connected_at untouched so a sync never
      // resets the rule-04 ramp clock.
      const { error } = await svc
        .from("linkedin_accounts")
        .update({ status: a.status, profile_url: a.profileUrl, display_name: a.displayName, updated_at: now() })
        .eq("id", action.rowId);
      if (error) {
        console.error("reconcileLinkedInAccounts: update failed", error);
        lastError = error.message;
      } else synced++;
      continue;
    }

    if (action.kind === "revive") {
      // Reconnect under a fresh provider seat: rewrite OUR row in place (lead assignments
      // survive) and release the superseded seat so the provider stops billing it.
      const { error } = await svc
        .from("linkedin_accounts")
        .update({
          provider_ref: a.providerRef,
          status: "active",
          profile_url: a.profileUrl,
          display_name: a.displayName,
          connected_at: now(), // a reconnect restarts the ramp clock
          updated_at: now(),
        })
        .eq("id", action.rowId);
      if (error) {
        console.error("reconcileLinkedInAccounts: revive failed", error);
        lastError = error.message;
        continue;
      }
      synced++;
      try {
        await infra.deleteConnectedAccount(action.oldProviderRef);
      } catch (err) {
        console.error("reconcile: superseded seat release failed (health sweep retries):", err);
      }
      continue;
    }

    // insert — a genuinely new identity for this tenant (the first-connect backstop)
    const { error } = await svc.from("linkedin_accounts").insert({
      account_id: accountId,
      provider_ref: a.providerRef,
      profile_url: a.profileUrl,
      display_name: a.displayName,
      status: a.status,
      connected_at: a.status === "active" ? now() : null,
    });
    if (error) {
      console.error("reconcileLinkedInAccounts: insert failed", error);
      lastError = error.message;
    } else synced++;
  }

  if (synced > 0) {
    // Trial-on-activation (owner decision 2026-07-15): the first active connect starts the
    // no-card trial clock. Idempotent — only when trialing and the clock is still unset; the
    // webhook path (jobs `upsertLinkedInAccountStatus`) applies the same rule.
    const { error } = await svc
      .from("accounts")
      .update({ trial_ends_at: new Date(Date.now() + TRIAL_DAYS * 86_400_000).toISOString() })
      .eq("id", accountId)
      .eq("subscription_status", "trialing")
      .is("trial_ends_at", null);
    if (error) console.error("reconcileLinkedInAccounts: trial clock stamp failed", error);
    return { synced, claimed: true, failure: null };
  }
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

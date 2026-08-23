import "server-only";
import { createLinkedInInfraFromEnv, type ConnectedAccount } from "@vantera/linkedin-infra";
import { createServiceClient } from "@/lib/supabase/service";
import { planLinkedInReconcile, type ExistingRow } from "./reconcile-plan";

/**
 * Reconcile the provider's connected LinkedIn accounts into `linkedin_accounts`
 * for `accountId`. This is the webhook-independent fallback so a connected
 * account shows up even when the hosted-auth `account_status` webhook is missed
 * (e.g. immediately on return from the connect flow) — it is never the primary
 * attribution path, just a reliable backstop.
 *
 * All ownership decisions live in `planLinkedInReconcile`. Pass `adoptNew` only when
 * handling a return from the connect flow: that is the one moment a brand-new provider
 * account can be attributed to this tenant at all.
 *
 * `accountId` MUST be resolved from the caller's session (RLS) — never passed
 * from client input.
 */
export async function reconcileLinkedInAccounts(
  accountId: string,
  options: { adoptNew?: boolean } = {}
): Promise<{ synced: number; unclaimed: number }> {
  const infra = createLinkedInInfraFromEnv();
  const accounts: ConnectedAccount[] = await infra.listAccounts();
  if (accounts.length === 0) return { synced: 0, unclaimed: 0 };

  const svc = createServiceClient();
  const { data: allRows } = await svc
    .from("linkedin_accounts")
    .select("id, account_id, provider_ref, profile_url, status, connected_at")
    .returns<ExistingRow[]>();

  const { ops, unclaimed } = planLinkedInReconcile(accountId, accounts, allRows ?? [], {
    adoptNew: options.adoptNew ?? false,
  });

  const now = new Date().toISOString();
  let synced = 0;
  // The trial clock starts on a real activation, not on any write — a row that merely
  // appeared as 'connecting' must not burn a day of the trial.
  let activated = false;

  for (const op of ops) {
    if (op.kind === "update") {
      const { error } = await svc
        .from("linkedin_accounts")
        .update({
          ...(op.status ? { status: op.status } : {}),
          ...(op.setConnectedAt ? { connected_at: now } : {}),
          profile_url: op.profileUrl,
          display_name: op.displayName,
          updated_at: now,
        })
        .eq("id", op.rowId);
      if (!error) {
        synced++;
        if (op.status === "active") activated = true;
      }
      continue;
    }

    if (op.kind === "reconnect") {
      const { error } = await svc
        .from("linkedin_accounts")
        .update({
          provider_ref: op.providerRef,
          status: "active",
          profile_url: op.profileUrl,
          display_name: op.displayName,
          connected_at: now, // a reconnect restarts the ramp clock
          updated_at: now,
        })
        .eq("id", op.rowId);
      if (error) continue;
      synced++;
      activated = true;
      try {
        await infra.deleteConnectedAccount(op.supersededRef); // stop billing the dead seat
      } catch (err) {
        console.error("reconcile: superseded seat release failed (health sweep retries):", err);
      }
      continue;
    }

    const { error } = await svc.from("linkedin_accounts").insert({
      account_id: accountId,
      provider_ref: op.providerRef,
      profile_url: op.profileUrl,
      display_name: op.displayName,
      status: op.status,
      connected_at: op.setConnectedAt ? now : null,
    });
    if (!error) {
      synced++;
      if (op.status === "active") activated = true;
    }
  }

  // Trial-on-activation (2026-07-15): first active connect starts the 7-day clock.
  if (activated) {
    await svc
      .from("accounts")
      .update({ trial_ends_at: new Date(Date.now() + 7 * 86_400_000).toISOString() })
      .eq("id", accountId)
      .eq("subscription_status", "trialing")
      .is("trial_ends_at", null);
  }
  return { synced, unclaimed };
}

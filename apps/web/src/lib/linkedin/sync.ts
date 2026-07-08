import "server-only";
import { createLinkedInInfraFromEnv, type ConnectedAccount } from "@vantera/linkedin-infra";
import { createServiceClient } from "@/lib/supabase/service";

/** Profile-identity key: the same human under any URL casing/trailing-slash variant. */
function identityOf(url: string | null): string | null {
  if (!url) return null;
  try {
    const u = new URL(url);
    return `${u.hostname.replace(/^www\./, "")}${u.pathname}`.toLowerCase().replace(/\/+$/, "");
  } catch {
    return url.toLowerCase().replace(/\/+$/, "");
  }
}

interface Row {
  id: string;
  account_id: string;
  provider_ref: string;
  profile_url: string | null;
}

/**
 * Reconcile the provider's connected LinkedIn accounts into `linkedin_accounts`
 * for `accountId`. This is the webhook-independent fallback so a connected
 * account shows up even when the hosted-auth `account_status` webhook is missed
 * (e.g. immediately on return from the connect flow) — it is never the primary
 * attribution path, just a reliable backstop.
 *
 * Identity-safe (2026-07-08 triple-seat incident): a provider account whose
 * PROFILE matches a row this tenant already holds is a reconnect under a fresh
 * ref — the existing row is revived in place (lead assignments survive) and the
 * superseded provider seat is released. New rows are only inserted for identities
 * nobody holds; identities held by a DIFFERENT tenant are never claimed.
 *
 * `accountId` MUST be resolved from the caller's session (RLS) — never passed
 * from client input.
 */
export async function reconcileLinkedInAccounts(
  accountId: string
): Promise<{ synced: number }> {
  const infra = createLinkedInInfraFromEnv();
  const accounts: ConnectedAccount[] = await infra.listAccounts();
  if (accounts.length === 0) return { synced: 0 };

  const svc = createServiceClient();
  const { data: allRows } = await svc
    .from("linkedin_accounts")
    .select("id, account_id, provider_ref, profile_url")
    .returns<Row[]>();
  const rows = allRows ?? [];
  const byRef = new Map(rows.map((r) => [r.provider_ref, r]));

  let synced = 0;
  for (const a of accounts) {
    const existing = byRef.get(a.providerRef);

    // Owned by another tenant — never steal it.
    if (existing && existing.account_id !== accountId) continue;

    if (existing) {
      // Routine refresh of a row we already hold; connected_at untouched so a sync
      // never resets the rule-04 ramp clock.
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
      continue;
    }

    // A ref nobody holds. Match by PROFILE identity before inserting anything.
    const identity = identityOf(a.profileUrl);
    const sameIdentity = identity
      ? rows.filter((r) => identityOf(r.profile_url) === identity)
      : [];
    if (sameIdentity.some((r) => r.account_id !== accountId)) continue; // another tenant's human
    const ours = sameIdentity.find((r) => r.account_id === accountId);

    if (ours) {
      // Reconnect under a fresh provider account: revive OUR existing row in place and
      // release the superseded seat — never a second row for the same person.
      if (a.status !== "active") continue; // don't adopt a dead duplicate
      const oldRef = ours.provider_ref;
      const { error } = await svc
        .from("linkedin_accounts")
        .update({
          provider_ref: a.providerRef,
          status: "active",
          profile_url: a.profileUrl,
          display_name: a.displayName,
          connected_at: new Date().toISOString(), // a reconnect restarts the ramp clock
          updated_at: new Date().toISOString(),
        })
        .eq("id", ours.id);
      if (!error) {
        synced++;
        ours.provider_ref = a.providerRef;
        byRef.set(a.providerRef, ours);
        try {
          await infra.deleteConnectedAccount(oldRef); // stop billing the dead seat
        } catch (err) {
          console.error("reconcile: superseded seat release failed (health sweep retries):", err);
        }
      }
      continue;
    }

    // Genuinely new identity for this tenant — the first-connect backstop.
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
  return { synced };
}

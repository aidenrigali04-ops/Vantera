/**
 * Pure decision layer for reconciling provider-connected LinkedIn identities into
 * `linkedin_accounts`. No IO — `sync.ts` supplies the provider list + existing rows and
 * executes the plan, so the tenancy rules below are unit-testable (rule 13: pure core).
 *
 * Why a plan at all: the provider workspace is SHARED across every Vantera tenant, so
 * `listAccounts()` returns other customers' identities. Deciding what may be claimed is
 * the security-critical part of this flow and deserves its own tested unit. Three rules,
 * each from a real incident:
 *   1. an identity already owned by a different tenant is never re-claimed;
 *   2. a provider account whose PROFILE matches a row this tenant already holds is a
 *      reconnect under a fresh ref — revive that row in place (lead assignments survive) and
 *      release the superseded seat, never a second row for the same human (2026-07-08
 *      triple-seat incident);
 *   3. `providerRef` scopes a post-connect reconcile to the one identity the redirect named,
 *      so a single pass can't sweep every unowned identity in the workspace into this tenant.
 */

export interface ProviderAccountLike {
  providerRef: string;
  displayName: string | null;
  profileUrl: string | null;
  status: "active" | "restricted" | "disconnected";
}

/** An existing row, as read with the service role (cross-tenant visibility is required). */
export interface ExistingRow {
  id: string;
  accountId: string;
  providerRef: string;
  profileUrl: string | null;
}

export type ReconcileAction =
  | { kind: "insert"; account: ProviderAccountLike }
  | { kind: "update"; rowId: string; account: ProviderAccountLike }
  /** Same human, new provider seat: rewrite the row's ref and release the old seat. */
  | { kind: "revive"; rowId: string; oldProviderRef: string; account: ProviderAccountLike }
  | {
      kind: "skip";
      providerRef: string;
      reason: "owned-by-other-tenant" | "identity-held-by-other-tenant" | "dead-duplicate" | "out-of-scope";
    };

export interface ReconcilePlanInput {
  /** Tenant to claim into — ALWAYS resolved from the session (rule 02). */
  accountId: string;
  providerAccounts: ProviderAccountLike[];
  existingRows: ExistingRow[];
  /**
   * When set, only this provider account is considered — the one the hosted-auth redirect
   * just named. `null`/undefined = full sync (the Settings → Channels refresh).
   */
  providerRef?: string | null;
}

/** Profile-identity key: the same human under any URL casing/trailing-slash variant. */
export function identityOf(url: string | null): string | null {
  if (!url) return null;
  try {
    const u = new URL(url);
    return `${u.hostname.replace(/^www\./, "")}${u.pathname}`.toLowerCase().replace(/\/+$/, "");
  } catch {
    return url.toLowerCase().replace(/\/+$/, "");
  }
}

export function planReconcile(input: ReconcilePlanInput): ReconcileAction[] {
  const byRef = new Map<string, ExistingRow>();
  for (const row of input.existingRows) byRef.set(row.providerRef, row);

  const scoped = input.providerRef?.trim() || null;
  const actions: ReconcileAction[] = [];

  for (const account of input.providerAccounts) {
    if (scoped && account.providerRef !== scoped) {
      actions.push({ kind: "skip", providerRef: account.providerRef, reason: "out-of-scope" });
      continue;
    }

    const existing = byRef.get(account.providerRef);
    if (existing) {
      // Rule 1 — another tenant already holds this ref: never re-claim it.
      if (existing.accountId !== input.accountId) {
        actions.push({ kind: "skip", providerRef: account.providerRef, reason: "owned-by-other-tenant" });
      } else {
        actions.push({ kind: "update", rowId: existing.id, account });
      }
      continue;
    }

    // A ref nobody holds. Rule 2 — match by PROFILE identity before inserting anything.
    const identity = identityOf(account.profileUrl);
    const sameIdentity = identity
      ? input.existingRows.filter((r) => identityOf(r.profileUrl) === identity)
      : [];
    if (sameIdentity.some((r) => r.accountId !== input.accountId)) {
      actions.push({ kind: "skip", providerRef: account.providerRef, reason: "identity-held-by-other-tenant" });
      continue;
    }
    const ours = sameIdentity.find((r) => r.accountId === input.accountId);
    if (ours) {
      if (account.status !== "active") {
        // don't adopt a dead duplicate of a human we already hold
        actions.push({ kind: "skip", providerRef: account.providerRef, reason: "dead-duplicate" });
      } else {
        actions.push({ kind: "revive", rowId: ours.id, oldProviderRef: ours.providerRef, account });
      }
      continue;
    }

    actions.push({ kind: "insert", account });
  }

  return actions;
}

/** True when the plan would attach at least one identity to this tenant. */
export function planClaimsAnything(actions: ReconcileAction[]): boolean {
  return actions.some((a) => a.kind === "insert" || a.kind === "update" || a.kind === "revive");
}

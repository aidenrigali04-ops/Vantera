/**
 * Pure decision layer for reconciling provider-connected LinkedIn identities into
 * `linkedin_accounts`. No IO — `sync.ts` supplies the provider list + existing rows and
 * executes the plan, so the tenancy rules below are unit-testable (rule 13: pure core).
 *
 * Why a plan at all: the provider workspace is SHARED across every Vantera tenant, so
 * `listAccounts()` returns other customers' identities too. Deciding what may be claimed
 * is the security-critical part of this flow and deserves its own tested unit.
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
}

export type ReconcileAction =
  | { kind: "insert"; account: ProviderAccountLike }
  | { kind: "update"; rowId: string; account: ProviderAccountLike }
  | { kind: "skip"; providerRef: string; reason: "owned-by-other-tenant" | "out-of-scope" };

export interface ReconcilePlanInput {
  /** Tenant to claim into — ALWAYS resolved from the session (rule 02). */
  accountId: string;
  providerAccounts: ProviderAccountLike[];
  existingRows: ExistingRow[];
  /**
   * When set, only this provider account is considered — the one the hosted-auth redirect
   * just named. Scoping matters: without it a single reconcile claims EVERY unowned identity
   * in the shared provider workspace into whichever tenant happens to sync first.
   * `null`/undefined = full sync (the Settings → Channels refresh).
   */
  providerRef?: string | null;
}

export function planReconcile(input: ReconcilePlanInput): ReconcileAction[] {
  const owner = new Map<string, ExistingRow>();
  for (const row of input.existingRows) owner.set(row.providerRef, row);

  const scoped = input.providerRef?.trim() || null;
  const actions: ReconcileAction[] = [];

  for (const account of input.providerAccounts) {
    if (scoped && account.providerRef !== scoped) {
      actions.push({ kind: "skip", providerRef: account.providerRef, reason: "out-of-scope" });
      continue;
    }
    const existing = owner.get(account.providerRef);
    if (existing && existing.accountId !== input.accountId) {
      // Another tenant already holds this identity — never re-claim it.
      actions.push({ kind: "skip", providerRef: account.providerRef, reason: "owned-by-other-tenant" });
      continue;
    }
    actions.push(
      existing ? { kind: "update", rowId: existing.id, account } : { kind: "insert", account }
    );
  }

  return actions;
}

/** True when the plan would attach at least one identity to this tenant. */
export function planClaimsAnything(actions: ReconcileAction[]): boolean {
  return actions.some((a) => a.kind === "insert" || a.kind === "update");
}

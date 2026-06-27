import { isEligibleForDeletion } from "../lib/deletion";

/** A still-pending deletion request: the account to wipe and when erasure was requested. */
export interface PendingDeletionRequest {
  accountId: string;
  requestedAt: Date;
}

export interface AccountDeletionStore {
  /** Every deletion request still in 'pending' status (account not yet wiped). */
  listPendingDeletionRequests(): Promise<PendingDeletionRequest[]>;
  /** The provider refs of the account's connected LinkedIn identities (for vendor cleanup). */
  listAccountLinkedInRefs(accountId: string): Promise<string[]>;
  /**
   * Hard-delete the account. FK cascades wipe all tenant data AND the
   * account_deletion_requests row itself, so a processed request never re-appears.
   */
  deleteAccount(accountId: string): Promise<void>;
}

export interface AccountDeletionDeps {
  store: AccountDeletionStore;
  /**
   * Disconnect a connected LinkedIn identity from the provider (rule 11 vendor cleanup) so the
   * provider stops holding/billing the tenant's connection. The DB cascade drops our rows but
   * never tells the provider; without this, deleted accounts leak ongoing provider cost.
   */
  disconnectLinkedIn: (connectedAccountRef: string) => Promise<void>;
  now?: () => Date;
  /** Surface a per-account vendor/delete failure without aborting the sweep (the wrapper logs it). */
  onError?: (accountId: string, error: unknown) => void;
}

export interface AccountDeletionSummary {
  processed: number;
  skipped: number;
  failed: number;
  /** Connected identities disconnected from the provider across the sweep. */
  disconnected: number;
}

/**
 * Rule 11 GDPR deletion path (pure core, deps injected per rule 13). For every account whose
 * deletion request has cleared the 7-day grace window: first disconnect its provider connections
 * (so no platform usage/billing continues for a deleted tenant), then hard-delete (FK cascades
 * wipe all tenant data). Accounts still inside the grace window are untouched. Vendor and delete
 * failures are recorded and skipped, never aborting the sweep — one bad row can't strand the rest.
 */
export async function runAccountDeletion(deps: AccountDeletionDeps): Promise<AccountDeletionSummary> {
  const now = deps.now?.() ?? new Date();
  const requests = await deps.store.listPendingDeletionRequests();

  let processed = 0;
  let skipped = 0;
  let failed = 0;
  let disconnected = 0;
  for (const req of requests) {
    if (!isEligibleForDeletion(req.requestedAt, now)) {
      skipped += 1;
      continue;
    }

    // Vendor cleanup BEFORE the hard delete: stop the provider holding/billing the connection.
    // Best-effort per ref — a provider error is logged but never blocks the erasure (compliance
    // requires the delete to proceed; a stale provider connection is an ops cleanup, not a blocker).
    const refs = await deps.store.listAccountLinkedInRefs(req.accountId);
    for (const ref of refs) {
      try {
        await deps.disconnectLinkedIn(ref);
        disconnected += 1;
      } catch (error) {
        deps.onError?.(req.accountId, error);
      }
    }

    try {
      await deps.store.deleteAccount(req.accountId);
      processed += 1;
    } catch (error) {
      failed += 1;
      deps.onError?.(req.accountId, error);
    }
  }
  return { processed, skipped, failed, disconnected };
}

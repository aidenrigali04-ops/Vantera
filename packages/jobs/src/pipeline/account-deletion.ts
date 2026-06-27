import { isEligibleForDeletion } from "../lib/deletion";

/** A still-pending deletion request: the account to wipe and when erasure was requested. */
export interface PendingDeletionRequest {
  accountId: string;
  requestedAt: Date;
}

export interface AccountDeletionStore {
  /** Every deletion request still in 'pending' status (account not yet wiped). */
  listPendingDeletionRequests(): Promise<PendingDeletionRequest[]>;
  /**
   * Hard-delete the account. FK cascades wipe all tenant data AND the
   * account_deletion_requests row itself, so a processed request never re-appears.
   */
  deleteAccount(accountId: string): Promise<void>;
}

export interface AccountDeletionDeps {
  store: AccountDeletionStore;
  now?: () => Date;
  /** Surface a per-account delete failure without aborting the batch (the wrapper logs it). */
  onError?: (accountId: string, error: unknown) => void;
}

export interface AccountDeletionSummary {
  processed: number;
  skipped: number;
  failed: number;
}

/**
 * Rule 11 GDPR deletion path (pure core, deps injected per rule 13). Hard-deletes every account
 * whose deletion request has cleared the 7-day grace window; accounts still inside the grace
 * window are left untouched. One failing delete is recorded and skipped, never aborting the
 * sweep, so a single bad row can't strand every other pending erasure.
 */
export async function runAccountDeletion(deps: AccountDeletionDeps): Promise<AccountDeletionSummary> {
  const now = deps.now?.() ?? new Date();
  const requests = await deps.store.listPendingDeletionRequests();

  let processed = 0;
  let skipped = 0;
  let failed = 0;
  for (const req of requests) {
    if (!isEligibleForDeletion(req.requestedAt, now)) {
      skipped += 1;
      continue;
    }
    try {
      await deps.store.deleteAccount(req.accountId);
      processed += 1;
    } catch (error) {
      failed += 1;
      deps.onError?.(req.accountId, error);
    }
  }
  return { processed, skipped, failed };
}

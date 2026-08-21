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
   * Accounts with zero members — their auth users were deleted outside the app (e.g. the
   * Supabase dashboard), so nobody exists who could ever file a deletion request for them.
   */
  listOrphanAccountIds(): Promise<string[]>;
  /** The provider refs of the account's connected LinkedIn identities (for vendor cleanup). */
  listAccountLinkedInRefs(accountId: string): Promise<string[]>;
  /** Stop all spend immediately: pause live agents + freeze outreach. Idempotent. */
  pauseAccountUsage(accountId: string): Promise<void>;
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
  /** Member-less accounts torn down (paused + disconnected + erased) this sweep. */
  orphansProcessed: number;
}

/**
 * Rule 11 GDPR deletion path (pure core, deps injected per rule 13). Two lanes, one sweep:
 *
 * 1. REQUESTED deletions (Danger Zone): accounts whose request cleared the 7-day grace window —
 *    disconnect provider connections (so no platform usage/billing continues for a deleted
 *    tenant), then hard-delete (FK cascades wipe all tenant data). In-grace requests untouched.
 * 2. ORPHANED accounts: zero members left (auth users deleted outside the app, e.g. the Supabase
 *    dashboard) — nobody can file a request, and every hour they survive burns agent + provider
 *    credits. Owner decision (2026-07-04): NO grace — quarantine spend first (pause agents,
 *    freeze outreach), disconnect providers, then erase immediately.
 *
 * Vendor and delete failures are recorded and skipped, never aborting the sweep — one bad row
 * can't strand the rest.
 */
export async function runAccountDeletion(deps: AccountDeletionDeps): Promise<AccountDeletionSummary> {
  const now = deps.now?.() ?? new Date();
  const requests = await deps.store.listPendingDeletionRequests();

  let processed = 0;
  let skipped = 0;
  let failed = 0;
  let disconnected = 0;
  let orphansProcessed = 0;
  const erased = new Set<string>();

  // Vendor cleanup BEFORE the hard delete: stop the provider holding/billing the connection.
  // Best-effort per ref — a provider error is logged but never blocks the erasure (compliance
  // requires the delete to proceed; a stale provider connection is an ops cleanup, not a blocker).
  const disconnectAll = async (accountId: string) => {
    const refs = await deps.store.listAccountLinkedInRefs(accountId);
    for (const ref of refs) {
      try {
        await deps.disconnectLinkedIn(ref);
        disconnected += 1;
      } catch (error) {
        deps.onError?.(accountId, error);
      }
    }
  };

  for (const req of requests) {
    if (!isEligibleForDeletion(req.requestedAt, now)) {
      skipped += 1;
      continue;
    }

    await disconnectAll(req.accountId);

    try {
      await deps.store.deleteAccount(req.accountId);
      erased.add(req.accountId);
      processed += 1;
    } catch (error) {
      failed += 1;
      deps.onError?.(req.accountId, error);
    }
  }

  for (const accountId of await deps.store.listOrphanAccountIds()) {
    if (erased.has(accountId)) continue; // already wiped via its own request this sweep

    // Quarantine FIRST so spend stops this hour even if the erasure below fails.
    try {
      await deps.store.pauseAccountUsage(accountId);
    } catch (error) {
      deps.onError?.(accountId, error);
    }

    await disconnectAll(accountId);

    try {
      await deps.store.deleteAccount(accountId);
      orphansProcessed += 1;
    } catch (error) {
      failed += 1;
      deps.onError?.(accountId, error);
    }
  }

  return { processed, skipped, failed, disconnected, orphansProcessed };
}

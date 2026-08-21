/**
 * R5 trial-ending email (spec 2026-07-15): one honest heads-up ~2 days before a trial
 * lapses — previously the only warning was an in-app banner the user had to log in to see.
 * Pipeline core with injected deps (rule 13); idempotent via trial_ending_notified_at.
 * Accounts that never connected LinkedIn have trial_ends_at NULL and are never selected —
 * their clock hasn't started.
 */

export interface TrialEndingAccount {
  id: string;
  trialEndsAt: string;
  emails: string[];
}

export interface TrialEndingDeps {
  store: {
    /** trialing + ends within the window + not yet notified + lifecycle emails on */
    getTrialEndingAccounts(now: Date, withinMs: number): Promise<TrialEndingAccount[]>;
    /** The idempotence write. Must carry nothing else — see the call site below. */
    markTrialEndingNotified(ids: string[]): Promise<void>;
    /**
     * Collision-guard bookkeeping for the pull-back email (spec 2026-07-18). Deliberately a
     * SEPARATE call from markTrialEndingNotified and optional so tests need not stub it.
     */
    stampLifecycleEmails?(ids: string[], at: Date): Promise<void>;
  };
  send(opts: { to: string; daysLeft: number }): Promise<void>;
  now?: () => Date;
}

export interface TrialEndingSummary {
  status: "completed";
  notified: number;
  emailsSent: number;
  /**
   * Failures of the best-effort collision-guard stamp. Counted rather than swallowed: the stamp
   * is the one write here that can fail on a schema the rest of the job doesn't need (0060), and
   * without a counter that failure is invisible — the trigger wrapper logs this summary.
   */
  lifecycleStampFailures: number;
}

const WINDOW_MS = 2 * 24 * 60 * 60 * 1000;

export async function runTrialEnding(deps: TrialEndingDeps): Promise<TrialEndingSummary> {
  const now = deps.now ? deps.now() : new Date();
  const due = await deps.store.getTrialEndingAccounts(now, WINDOW_MS);
  let emailsSent = 0;
  const notified: string[] = [];
  for (const account of due) {
    const daysLeft = Math.max(
      1,
      Math.ceil((new Date(account.trialEndsAt).getTime() - now.getTime()) / 86_400_000)
    );
    let sent = 0;
    for (const to of account.emails) {
      try {
        await deps.send({ to, daysLeft });
        sent += 1;
      } catch {
        // best-effort per recipient — one bad address must not block the rest
      }
    }
    if (sent > 0) {
      emailsSent += sent;
      notified.push(account.id);
    }
  }
  let lifecycleStampFailures = 0;
  if (notified.length > 0) {
    // Order and isolation are load-bearing. The emails above have ALREADY reached inboxes, so the
    // idempotence write goes first, alone, and uncaught: if it fails the run must reject loudly,
    // because the agent-scheduler tick will otherwise re-send this email to these accounts every
    // 15 minutes forever. The pull-back collision-guard stamp is a bookkeeping nicety for a
    // different feature and is therefore second and non-fatal — a new feature's write must never
    // be able to take the pre-existing idempotence write down with it (e.g. migration 0060 not yet
    // applied: `column "lifecycle_last_email_at" does not exist`).
    await deps.store.markTrialEndingNotified(notified);
    try {
      await deps.store.stampLifecycleEmails?.(notified, now);
    } catch {
      // contained by contract — worst case is one extra pull-back email; counted below
      lifecycleStampFailures += 1;
    }
  }
  return { status: "completed", notified: notified.length, emailsSent, lifecycleStampFailures };
}

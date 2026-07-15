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
    markTrialEndingNotified(ids: string[]): Promise<void>;
  };
  send(opts: { to: string; daysLeft: number }): Promise<void>;
  now?: () => Date;
}

export interface TrialEndingSummary {
  status: "completed";
  notified: number;
  emailsSent: number;
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
  if (notified.length > 0) await deps.store.markTrialEndingNotified(notified);
  return { status: "completed", notified: notified.length, emailsSent };
}

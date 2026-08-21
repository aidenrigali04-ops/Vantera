// Stale-reply safeguard — the durable answer to "ensure this never happens again" (2026-07-09,
// after a batch of real replies sat unanswered: they arrived before the responder was deployed,
// were classified + notified, then aged past the 72h auto-answer window with no reply ever sent).
//
// Every genuine reply already raises a passive "X replied" notification, but that's easy to miss
// and doesn't say "nobody has answered this". This sweep is the active net: a respondable reply
// that has been sitting with NO answer sent, NO draft queued to answer it, and NO human on the
// thread gets escalated to a needs_human alert — the same loud, actionable signal the turn-cap and
// disconnect paths use. It catches a responder that's off/misconfigured, a review-mode account
// whose drafts were declined, or any reply that slipped through, before the thread goes cold.
//
// Piggybacks the 15-min agent-scheduler tick (the Trigger schedule quota is 10/10 — same reason as
// account-health). Idempotent with no schema change: it skips any lead that already has a
// needs_human alert dated after the reply, so each orphaned reply escalates at most once.

/** A respondable reply that came in and was never answered. */
export interface StaleReply {
  accountId: string;
  leadId: string;
  receivedAt: Date;
}

export interface ReplyBacklogStore {
  /**
   * Respondable replies (interested/neutral/other) received between `lookbackMs` and `staleMs`
   * ago with: no agent message delivered after the reply, nothing queued to answer it, the run not
   * human-handled (paused_reply) or terminal (converted/stopped), and no needs_human alert already
   * raised since the reply. Newest reply per lead; ordered so the core can dedupe by lead.
   */
  getStaleUnansweredReplies(now: Date, staleMs: number, lookbackMs: number): Promise<StaleReply[]>;
  insertLeadNotification(n: { accountId: string; leadId: string; kind: "needs_human"; body: string }): Promise<void>;
}

export interface ReplyBacklogDeps {
  store: ReplyBacklogStore;
  now: () => Date;
}

/** How long an unanswered respondable reply may sit before it's escalated. Well past the responder's
 *  speed lane (15–90s) plus a review cycle, so a healthy auto-answer or a queued draft never trips
 *  it — only a genuinely orphaned reply does. */
export const STALE_REPLY_MS = 6 * 3_600_000;
/** Only recent orphans — don't dredge up ancient history (bounds the first-run alert volume). */
export const REPLY_LOOKBACK_MS = 7 * 86_400_000;

export interface ReplyBacklogSummary {
  status: "completed";
  candidates: number;
  escalated: number;
}

/**
 * One backlog-sweep tick. Escalates each orphaned reply's lead to needs_human exactly once (the
 * store's "no needs_human since the reply" filter is the idempotency guard; the per-lead dedupe
 * here stops a lead with several unanswered replies from getting a pile of alerts in one tick).
 */
export async function runReplyBacklog(deps: ReplyBacklogDeps): Promise<ReplyBacklogSummary> {
  const now = deps.now();
  const stale = await deps.store.getStaleUnansweredReplies(now, STALE_REPLY_MS, REPLY_LOOKBACK_MS);

  const seen = new Set<string>();
  let escalated = 0;
  for (const r of stale) {
    if (seen.has(r.leadId)) continue;
    seen.add(r.leadId);
    await deps.store.insertLeadNotification({
      accountId: r.accountId,
      leadId: r.leadId,
      kind: "needs_human",
      body: "A prospect replied and hasn't been answered yet — open the thread and reply from their page.",
    });
    escalated += 1;
  }
  return { status: "completed", candidates: stale.length, escalated };
}

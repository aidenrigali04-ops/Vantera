/**
 * Mailbox deliverability health (rule 04 spirit / report #5: domain burnout). Pure assessment of
 * a mailbox's rolling sent/bounce/complaint counts → a status + the action the scheduler takes.
 * Thresholds are a non-configurable safety floor (like the channel ceilings in safety-limits.ts):
 * they protect the user's sending domain, not a preference. Grounded in provider norms — mailbox
 * providers throttle/block well before these — kept conservative.
 */

/** Below this many sends we can't judge a rate fairly — never burn a barely-used mailbox. */
export const HEALTH_MIN_SAMPLE = 20;

export const BOUNCE_WATCH = 0.04; // 4% — start throttling
export const BOUNCE_BURN = 0.08; // 8% — rotate off this mailbox
export const COMPLAINT_WATCH = 0.001; // 0.1%
export const COMPLAINT_BURN = 0.003; // 0.3% — well into block territory

export type MailboxHealthStatus = "healthy" | "watch" | "burned";
export type MailboxHealthAction = "continue" | "throttle" | "rotate";

export interface MailboxCounts {
  sent: number;
  bounces: number;
  complaints: number;
}

export interface MailboxHealth {
  sent: number;
  bounceRate: number;
  complaintRate: number;
  status: MailboxHealthStatus;
  action: MailboxHealthAction;
}

const ACTION: Record<MailboxHealthStatus, MailboxHealthAction> = {
  healthy: "continue",
  watch: "throttle",
  burned: "rotate",
};

export function assessMailboxHealth(counts: MailboxCounts): MailboxHealth {
  const sent = Math.max(0, counts.sent);
  const bounceRate = sent > 0 ? counts.bounces / sent : 0;
  const complaintRate = sent > 0 ? counts.complaints / sent : 0;

  let status: MailboxHealthStatus = "healthy";
  if (sent >= HEALTH_MIN_SAMPLE) {
    if (bounceRate >= BOUNCE_BURN || complaintRate >= COMPLAINT_BURN) {
      status = "burned";
    } else if (bounceRate >= BOUNCE_WATCH || complaintRate >= COMPLAINT_WATCH) {
      status = "watch";
    }
  }

  return { sent, bounceRate, complaintRate, status, action: ACTION[status] };
}

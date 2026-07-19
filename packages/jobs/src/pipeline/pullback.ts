/**
 * Pull-back email (spec 2026-07-18): tell a stalled user about the leads or drafts already
 * waiting for them, by name. Pure core with injected deps (rule 13) — `null` means "do not
 * send", mirroring composeWeeklySummary, so every skip reason is unit-testable without a mailer.
 *
 * Compose owns: opted out, no recipients, nothing waiting, nobody nameable, artifact too young,
 * and the 48h collision guard. The store owns ledger dedupe + the never-returned predicate.
 */

export type PullbackSegment = "drafts_waiting" | "leads_waiting";

export interface PullbackPreview {
  name: string;
  title: string | null;
  company: string | null;
}

export interface PullbackRow {
  accountId: string;
  userId: string;
  emails: string[];
  segment: PullbackSegment;
  touchNumber: 1 | 2;
  /** pending_review drafts (drafts_waiting) or sourced leads (leads_waiting) */
  itemCount: number;
  previews: PullbackPreview[];
  /** one real draft opener, drafts_waiting only */
  draftExcerpt: string | null;
  oldestArtifactAt: string;
  lifecycleEmailsEnabled: boolean;
  lifecycleLastEmailAt: string | null;
}

export interface PullbackMessage {
  to: string;
  /** Signed into the unsubscribe token — the opt-out identifies the USER, not the address. */
  userId: string;
  subject: string;
  segment: PullbackSegment;
  touchNumber: 1 | 2;
  lines: string[];
  ctaLabel: string;
  ctaUrl: string;
}

/** Pull-back always yields — trial-ending is time-critical, weekly-summary is scheduled. */
export const COLLISION_WINDOW_MS = 48 * 60 * 60 * 1000;
/** LinkedIn drafts reference recent activity and go stale; 24h is the honest floor. */
export const MIN_ARTIFACT_AGE_MS = 24 * 60 * 60 * 1000;

const MAX_NAMED = 3;

function describe(p: PullbackPreview): string {
  const tail = [p.title, p.company].filter(Boolean).join(" at ");
  return tail ? `${p.name} — ${tail}` : p.name;
}

export function composePullback(
  row: PullbackRow,
  appUrl: string,
  now: Date
): Omit<PullbackMessage, "to" | "userId"> | null {
  if (!row.lifecycleEmailsEnabled) return null;
  if (row.emails.length === 0) return null;
  if (row.itemCount <= 0) return null;
  // Never send a hollow email — the entire premise is that real value already exists.
  if (row.previews.length === 0) return null;

  const age = now.getTime() - new Date(row.oldestArtifactAt).getTime();
  if (age < MIN_ARTIFACT_AGE_MS) return null;

  if (row.lifecycleLastEmailAt) {
    const since = now.getTime() - new Date(row.lifecycleLastEmailAt).getTime();
    if (since < COLLISION_WINDOW_MS) return null;
  }

  const named = row.previews.slice(0, MAX_NAMED).map(describe);
  const n = row.itemCount;

  if (row.segment === "drafts_waiting") {
    const subject = n === 1 ? "Vera wrote 1 message for you" : `Vera wrote ${n} messages for you`;
    const lines = [
      n === 1
        ? "There's a message written and waiting for your approval. Nothing sends until you say so."
        : `There are ${n} messages written and waiting for your approval. Nothing sends until you say so.`,
      `They're addressed to people like ${named.join(", ")}.`,
    ];
    if (row.draftExcerpt) lines.push(`One of them opens: "${row.draftExcerpt.trim()}"`);
    return {
      subject,
      segment: row.segment,
      touchNumber: row.touchNumber,
      lines,
      ctaLabel: "Review the messages",
      // /review, not /inbox. The spec's one desired action is "return and approve one message",
      // and /review is the approval queue (draft cards, bulk approve, hotkeys — see dock-nav.tsx).
      // /inbox is the conversation cockpit: it lists statuses and has no approve affordance, so a
      // user who followed it landed one click short of the only thing this email asks for.
      ctaUrl: `${appUrl}/review`,
    };
  }

  const subject = n === 1 ? "1 buyer matched your ICP" : `${n} buyers matched your ICP`;
  const lines = [
    n === 1
      ? "Vera found and qualified a buyer that matches the ICP you set."
      : `Vera found and qualified ${n} buyers that match the ICP you set.`,
    `Among them: ${named.join(", ")}.`,
  ];
  return {
    subject,
    segment: row.segment,
    touchNumber: row.touchNumber,
    lines,
    ctaLabel: "See your leads",
    ctaUrl: `${appUrl}/leads`,
  };
}

export interface PullbackTouch {
  userId: string;
  accountId: string;
  segment: PullbackSegment;
  touchNumber: 1 | 2;
  messageBody: string;
}

export interface PullbackDeps {
  store: {
    /** Candidates already filtered for ledger dedupe + the never-returned predicate. */
    getPullbackCandidates(now: Date): Promise<PullbackRow[]>;
    recordTouch(touch: PullbackTouch): Promise<void>;
    stampLifecycleEmail(accountId: string, at: Date): Promise<void>;
  };
  send(message: PullbackMessage): Promise<void>;
  appUrl: string;
  now?: () => Date;
}

export interface PullbackSummary {
  status: "completed";
  touched: number;
  emailsSent: number;
  /**
   * recordTouch/stampLifecycleEmail failures, contained per row (see the comment below) so one
   * bad write never aborts the batch. Counted rather than swallowed: this job ticks every 15
   * minutes with no other alerting, so a persistently failing store would otherwise be invisible
   * until "two touches, ever" silently broke. The trigger wrapper logs this summary — a nonzero
   * count is the operator's signal to look at the store, not the compose core.
   */
  ledgerWriteFailures: number;
  /**
   * send() failures, one per failing recipient, contained per recipient so one bad address never
   * blocks the rest of the batch (same idiom as ledgerWriteFailures). Counted rather than
   * swallowed: a total env misconfiguration (missing RESEND creds, missing
   * LIFECYCLE_UNSUBSCRIBE_SECRET) throws inside send() for EVERY recipient, which — without this
   * counter — is byte-identical to "no candidates found" (touched:0, emailsSent:0) in the tick log,
   * forever. The trigger wrapper uses sendFailures alongside emailsSent to tell "nothing to do"
   * apart from "everything is broken".
   */
  sendFailures: number;
}

export async function runPullback(deps: PullbackDeps): Promise<PullbackSummary> {
  const now = deps.now ? deps.now() : new Date();
  const rows = await deps.store.getPullbackCandidates(now);

  let emailsSent = 0;
  let touched = 0;
  let ledgerWriteFailures = 0;
  let sendFailures = 0;

  for (const row of rows) {
    const composed = composePullback(row, deps.appUrl, now);
    // No ledger row on a skip: the touch is retried once the blocking condition clears.
    if (!composed) continue;

    let sent = 0;
    for (const to of row.emails) {
      try {
        await deps.send({ ...composed, to, userId: row.userId });
        sent += 1;
      } catch {
        // best-effort per recipient — one bad address must not block the rest; counted below
        sendFailures += 1;
      }
    }
    if (sent === 0) continue;

    // The email has already reached the recipient(s) at this point — count the row as
    // touched/sent regardless of what happens to the ledger writes below. The summary
    // reports what actually landed in inboxes, not what was successfully bookkept.
    emailsSent += sent;
    touched += 1;

    // Ledger writes are best-effort and isolated per row, same idiom as the per-recipient
    // send loop above: a DB blip on one row must not abandon every other unrelated row
    // still queued in this batch. The trade-off is a small duplicate-send window — if
    // either write throws, this row still looks eligible (undertouched / unstamped) on the
    // next tick and may email this account again. That is the correct trade versus rejecting
    // the whole runPullback promise, and the window is bounded by the two writes being
    // independent: whichever one succeeds still throttles the retry. In particular a
    // succeeding stampLifecycleEmail sets lifecycle_last_email_at, which composePullback's
    // 48h collision guard reads — so a row whose recordTouch keeps failing re-sends at most
    // once every 48h, not once every 15-minute tick. (It is NOT bounded by "a failing store
    // also fails getPullbackCandidates": an INSERT can fail while a SELECT succeeds.)
    try {
      await deps.store.recordTouch({
        userId: row.userId,
        accountId: row.accountId,
        segment: row.segment,
        touchNumber: row.touchNumber,
        messageBody: composed.lines.join("\n"),
      });
    } catch {
      // contained — see comment above; counted in ledgerWriteFailures below
      ledgerWriteFailures += 1;
    }
    try {
      await deps.store.stampLifecycleEmail(row.accountId, now);
    } catch {
      // contained — see comment above; counted in ledgerWriteFailures below
      ledgerWriteFailures += 1;
    }
  }

  return { status: "completed", touched, emailsSent, ledgerWriteFailures, sendFailures };
}

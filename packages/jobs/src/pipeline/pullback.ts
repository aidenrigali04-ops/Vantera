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
      ctaUrl: `${appUrl}/inbox`,
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

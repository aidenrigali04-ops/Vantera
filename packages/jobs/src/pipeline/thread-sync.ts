import type { LinkedInInfra, ThreadMessageEvent } from "@vantera/linkedin-infra";
import type { InboundSummary } from "./types";

/**
 * Thread sync (0073): the webhook-independent backstop that keeps every tenant's Vantera threads a
 * faithful mirror of their LinkedIn threads. The webhook is the primary path; this re-reads each
 * contacted lead's thread from the provider in rotation and routes every message through the SAME
 * inbound handler a webhook delivery uses. The handler is idempotent on the provider message id
 * (replies 0043, native messages 0073), so already-mirrored messages are cheap no-ops and only what
 * a webhook never delivered — an outage, a parser drift, anything from before a fix — is filled in.
 *
 * Found 2026-10-27: until the 10-22 echo fix every message the user typed natively in LinkedIn was
 * dropped at parse time, so those threads could only ever be recovered by reading them back.
 */

/** Leads re-read per connected identity per run — a backlog drains over several runs instead of a
 *  read storm (rule 04 account safety applies to READS too; see sync-connections). */
export const THREAD_SYNC_LEADS_PER_ACCOUNT = 10;
/** Messages newest-first read per thread — a conversation rarely outgrows one page between passes. */
export const THREAD_SYNC_MESSAGES_PER_THREAD = 50;
/** Messages younger than this belong to the webhook still in flight; the next pass covers them. */
export const THREAD_SYNC_QUIET_MS = 15 * 60_000;
/** Human-ish pause between consecutive thread reads (jittered ±50%). */
export const THREAD_SYNC_READ_GAP_MS = 1_500;

export interface ThreadSyncCandidate {
  leadId: string;
  accountId: string;
  /** the lead's member provider id — the thread's counterpart */
  attendeeProviderRef: string;
  /** the ACTIVE connected identity whose thread with the lead is read */
  connectedAccountRef: string;
}

export interface ThreadSyncStore {
  /** Contacted leads (provider ref known) on an active identity, least-recently synced first,
   *  at most `perAccount` per connected identity. */
  listThreadSyncCandidates(perAccount: number): Promise<ThreadSyncCandidate[]>;
  markThreadSynced(leadId: string, at: Date): Promise<void>;
}

export interface ThreadSyncDeps {
  store: ThreadSyncStore;
  linkedinInfra: Pick<LinkedInInfra, "listThreadMessages">;
  /** the inbound event handler (handleLinkedInEvent with the live deps) */
  handleEvent: (event: ThreadMessageEvent) => Promise<InboundSummary>;
  now?: () => Date;
  /** test hook — production uses the real jittered pause between thread reads */
  sleep?: (ms: number) => Promise<void>;
}

export interface ThreadSyncResult {
  threads: number;
  messages: number;
  errors: number;
  /** handler action → count; anything other than duplicates/own means the webhook had missed it */
  outcomes: Record<string, number>;
}

function eventTime(e: ThreadMessageEvent): number {
  return new Date(e.type === "reply" ? e.receivedAt : e.sentAt).getTime();
}

export async function runThreadSync(deps: ThreadSyncDeps): Promise<ThreadSyncResult> {
  const now = deps.now?.() ?? new Date();
  const sleep = deps.sleep ?? ((ms: number) => new Promise<void>((r) => setTimeout(r, ms)));
  const candidates = await deps.store.listThreadSyncCandidates(THREAD_SYNC_LEADS_PER_ACCOUNT);
  const result: ThreadSyncResult = { threads: 0, messages: 0, errors: 0, outcomes: {} };

  for (const [i, c] of candidates.entries()) {
    if (i > 0) await sleep(THREAD_SYNC_READ_GAP_MS * (0.5 + Math.random()));
    try {
      const events = await deps.linkedinInfra.listThreadMessages({
        connectedAccountId: c.connectedAccountRef,
        attendeeProviderRef: c.attendeeProviderRef,
        limit: THREAD_SYNC_MESSAGES_PER_THREAD,
      });
      for (const event of events) {
        if (now.getTime() - eventTime(event) < THREAD_SYNC_QUIET_MS) continue;
        const summary = await deps.handleEvent(event);
        result.messages += 1;
        result.outcomes[summary.action] = (result.outcomes[summary.action] ?? 0) + 1;
      }
      result.threads += 1;
    } catch {
      result.errors += 1;
    }
    // Rotate even on failure: a thread that keeps erroring (a disconnected seat, a deleted chat)
    // must never pin the front of the queue and starve every other lead's sync.
    await deps.store.markThreadSynced(c.leadId, now);
  }
  return result;
}

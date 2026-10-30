import { runConversationDecide, type ConversationDecideDeps } from "./conversation-decide";
import { normalizeLinkedInUrl } from "./copy-draft";
import type { ConversationMode, ConversationStore, InboundStore, SequenceTouchStore } from "./types";

/** Leads per scan; the scan re-runs every scheduler tick, so a backlog drains over a few ticks. */
export const FIRST_MESSAGE_SCAN_LIMIT = 50;

/**
 * A lead with a first_message decision this recent is not re-decided — in every mode: shadow and a
 * live `wait` both leave no message row, so without this the scan would re-decide (a policy model
 * call + a decision row) every scheduler tick.
 */
export const FIRST_MESSAGE_DECISION_COOLDOWN_MS = 24 * 3_600_000;

export interface FirstMessageDeps {
  store: ConversationStore &
    SequenceTouchStore &
    Pick<
      InboundStore,
      | "getResponderBundle"
      | "isSuppressed"
      | "getLeadLinkedInUrl"
      | "insertLeadNotification"
      | "cancelPendingSends"
      | "stopSequenceForReply"
    >;
  decide: ConversationDecideDeps;
  mode: ConversationMode;
  now: () => Date;
}

export interface FirstMessageSummary {
  scanned: number;
  drafted: number;
  /** a graceful exit message was written (counted apart from ordinary first messages) */
  exited: number;
  waited: number;
  skipped: number;
  handedOff: number;
  /** a lead whose decide threw; logged and passed over so one bad lead never stops the batch */
  failed: number;
}

/**
 * First message at acceptance (spec §7.2). Under "live", copy-draft writes the connection note only
 * and this scan has the conversation core write the first message from the live thread for each
 * connected lead with no message-stage row (every acceptance path — webhook, connection sync, the
 * "already connected" invite cancel — converges on `linkedin_connected_at`). The note is a sent
 * invite turn, so the reader records its hook in `hooksUsed`; with no note there is no hook.
 * Under shadow / live_replies the legacy pair is still written and sent; the scan includes leads
 * whose pair message is parked (unsent) and logs a shadow decision against it.
 *
 * Idempotent: the scan's SQL excludes leads with a (sent) message row, leads decided within the
 * cooldown, and leads who spoke last; the core skips when an unsent message exists (live); and a
 * lead is decided at most once per run.
 */
export async function runFirstMessage(deps: FirstMessageDeps): Promise<FirstMessageSummary> {
  const summary: FirstMessageSummary = {
    scanned: 0,
    drafted: 0,
    exited: 0,
    waited: 0,
    skipped: 0,
    handedOff: 0,
    failed: 0,
  };
  const { mode, store } = deps;
  if (mode === "off") return summary;

  const rows = await store.listConnectedWithoutFirstMessage(FIRST_MESSAGE_SCAN_LIMIT, {
    includeParked: mode !== "live",
    decidedSince: new Date(deps.now().getTime() - FIRST_MESSAGE_DECISION_COOLDOWN_MS),
  });
  const seen = new Set<string>();
  for (const { accountId, leadId, campaignId } of rows) {
    summary.scanned += 1;
    if (seen.has(leadId)) {
      summary.skipped += 1;
      continue;
    }
    seen.add(leadId);
    try {
      const outcome = await decideOne(deps, mode, accountId, leadId, campaignId);
      summary[outcome] += 1;
    } catch (err) {
      summary.failed += 1;
      console.error("first-message: decide failed", { accountId, leadId, error: String(err) });
    }
  }
  return summary;
}

type Tally = Exclude<keyof FirstMessageSummary, "scanned" | "failed">;

async function decideOne(
  deps: FirstMessageDeps,
  mode: Exclude<ConversationMode, "off">,
  accountId: string,
  leadId: string,
  campaignId: string
): Promise<Tally> {
  const { store } = deps;
  // rule 11: the core checks again before any model call; this check keeps a suppressed lead
  // from even having its grounding bundle built.
  const url = await store.getLeadLinkedInUrl(accountId, leadId);
  if (url && (await store.isSuppressed(accountId, "linkedin", normalizeLinkedInUrl(url)))) return "skipped";
  const bundle = await store.getResponderBundle(accountId, leadId, campaignId);
  // defence behind the SQL: a person owns the thread, the lead already spoke (the reply path
  // answers that), or there is no live Outreach agent / grounding
  if (!bundle || bundle.humanHandled || bundle.thread.at(-1)?.role === "lead") return "skipped";

  const outcome = await runConversationDecide(
    {
      accountId,
      leadId,
      campaignId,
      trigger: { kind: "first_message" },
      mode,
      bundle,
      sellerName: bundle.context.accountName ?? null,
    },
    deps.decide
  );
  switch (outcome.action) {
    case "drafted":
      return "drafted";
    case "exit":
      return "exited";
    case "wait":
      return "waited";
    case "hand_to_human":
      return "handedOff";
    default:
      return "skipped";
  }
}

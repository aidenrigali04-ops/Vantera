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
  waited: number;
  skipped: number;
  handedOff: number;
}

/**
 * First message at acceptance (spec §7.2). With conversation intelligence on, copy-draft writes the
 * connection note only; this scan finds leads that are connected with no message-stage row (every
 * acceptance path — webhook, connection sync, the "already connected" invite cancel — converges on
 * `linkedin_connected_at`) and has the conversation core write the first message from the live
 * thread. The note is a sent invite turn, so the reader records its hook in `hooksUsed`; with no
 * note there is no hook.
 *
 * Idempotent: the scan excludes leads with a message row, the core skips when an unsent message
 * exists, a lead is decided at most once per run, and not again within the decision cooldown.
 */
export async function runFirstMessage(deps: FirstMessageDeps): Promise<FirstMessageSummary> {
  const summary: FirstMessageSummary = { scanned: 0, drafted: 0, waited: 0, skipped: 0, handedOff: 0 };
  const { mode, store } = deps;
  if (mode === "off") return summary;

  const rows = await store.listConnectedWithoutFirstMessage(FIRST_MESSAGE_SCAN_LIMIT);
  const recent =
    rows.length > 0
      ? await store.leadsDecidedSince(
          [...new Set(rows.map((r) => r.leadId))],
          "first_message",
          new Date(deps.now().getTime() - FIRST_MESSAGE_DECISION_COOLDOWN_MS)
        )
      : new Set<string>();
  const seen = new Set<string>();
  for (const { accountId, leadId, campaignId } of rows) {
    summary.scanned += 1;
    if (seen.has(leadId)) {
      summary.skipped += 1;
      continue;
    }
    seen.add(leadId);
    if (recent.has(leadId)) {
      summary.skipped += 1;
      continue;
    }

    // rule 11: the core checks again before any model call; this check keeps a suppressed lead
    // from even having its grounding bundle built.
    const url = await store.getLeadLinkedInUrl(accountId, leadId);
    if (url && (await store.isSuppressed(accountId, "linkedin", normalizeLinkedInUrl(url)))) {
      summary.skipped += 1;
      continue;
    }
    const bundle = await store.getResponderBundle(accountId, leadId, campaignId);
    // a person owns the thread, or the lead already spoke (the reply path answers that), or there
    // is no live Outreach agent / grounding: nothing to write here
    if (!bundle || bundle.humanHandled || bundle.thread.at(-1)?.role === "lead") {
      summary.skipped += 1;
      continue;
    }

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
      case "exit":
        summary.drafted += 1;
        break;
      case "wait":
        summary.waited += 1;
        break;
      case "hand_to_human":
        summary.handedOff += 1;
        break;
      default:
        summary.skipped += 1;
    }
  }
  return summary;
}

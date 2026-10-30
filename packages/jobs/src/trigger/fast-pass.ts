import { logger, task } from "@trigger.dev/sdk";
import { createDb } from "@vantera/db";
import { draftLinkedIn, draftLinkedInNote, rankLeads, scanWebsite } from "@vantera/agent-brains";
import { runFastPass } from "../pipeline/fast-pass";
import { runCopyDraft } from "../pipeline/copy-draft";
import { createConversationStore, createPgStore } from "../pipeline/pg-store";
import { createProspectData } from "../pipeline/prospect-source";

/**
 * The pre-payment fast pass — builds the Reveal (journey v2). Triggered directly from the
 * web app (LinkedIn connect return / /reveal load) with concurrencyKey=accountId; the
 * reveal_runs unique index upstream guarantees one run per account. The copy path runs
 * INLINE so 'done' truthfully means the first draft exists (a human is watching).
 */
export const fastPass = task({
  id: "fast-pass",
  queue: { concurrencyLimit: 1 },
  maxDuration: 900,
  run: async (payload: { accountId: string; revealRunId: string }) => {
    const db = createDb();
    const store = createPgStore(db);
    // same first-touch shape as copy-draft (spec §7.2): note only when conversation_policy is "live"
    const conversationMode = await createConversationStore(db).getConversationPolicyMode().catch(() => "off" as const);
    try {
      const summary = await runFastPass(payload, {
        store,
        prospectData: createProspectData(),
        scanFn: scanWebsite,
        rankFn: rankLeads,
        runDrafts: (p) =>
          runCopyDraft(p, {
            store,
            draftLinkedInFn: (input) => draftLinkedIn(input),
            conversationMode,
            draftLinkedInNoteFn: (input) => draftLinkedInNote(input),
          }),
      });
      logger.info("fast pass finished", { ...summary, accountId: payload.accountId });
      return summary;
    } catch (err) {
      // keep the ledger honest for the polling Reveal, then rethrow for Trigger retries
      await store.updateRevealRun(payload.revealRunId, { status: "failed", error: String(err) });
      throw err;
    }
  },
});

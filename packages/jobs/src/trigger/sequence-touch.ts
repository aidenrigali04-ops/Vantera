import { logger, task } from "@trigger.dev/sdk";
import { createDb } from "@vantera/db";
import { draftConversationMessage, fixConversationMessage, judgeCopy, rankLeads } from "@vantera/agent-brains";
import { withProviderAlert } from "../pipeline/provider-alert";
import { buildProviderAlertDeps } from "../pipeline/provider-alert-deps";
import { runSequenceTouch } from "../pipeline/sequence-touch";
import { buildConversationDeps } from "../pipeline/conversation-deps";
import { createPgStore } from "../pipeline/pg-store";
import { createProspectData } from "../pipeline/prospect-source";
import { runRefreshLead } from "../pipeline/refresh-lead";
import type { SequenceTouchDispatch } from "../pipeline/types";

/**
 * Draft and insert ONE LinkedIn follow-up touch for the orchestrator.
 * Suppression-checked before every draft (rule 11); stops at 'pending_review'/'approved'.
 */
export const sequenceTouch = task({
  id: "sequence-touch",
  maxDuration: 1800,
  run: async (payload: SequenceTouchDispatch) => {
    const db = createDb();
    const store = createPgStore(db);
    // Phase 2C fast-follow (best-of-N on the responder paths): the global `best_of_n`
    // rollout knob, read once per run; the pipeline core re-caps it and forces it to 1
    // whenever a judge isn't wired — mirrors trigger/copy-draft.ts.
    const bestOfN = await store.getBestOfN();
    // Conversation policy knob (spec §6.5): "off" (or a failed read) keeps the legacy draft path.
    const conversation = await buildConversationDeps(db, store, bestOfN);
    const outcome = await withProviderAlert(() => runSequenceTouch(payload, {
      store,
      draftFollowupFn: (input) => draftConversationMessage(input),
      fixFollowupFn: (original, input) => fixConversationMessage(original, input),
      judgeFn: (d, c) => judgeCopy(d, c),
      bestOfN,
      conversation,
      now: () => new Date(),
      refreshLead: (accountId, leadId) =>
        runRefreshLead(accountId, leadId, {
          store,
          prospectData: createProspectData(),
          rankFn: (candidates, ctx) => rankLeads(candidates, ctx),
        }),
    }), buildProviderAlertDeps(store));
    logger.info("sequence touch finished", { outcome, runId: payload.runId, stage: payload.stage });
    return { outcome };
  },
});

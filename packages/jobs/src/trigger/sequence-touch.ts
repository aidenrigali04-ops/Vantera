import { logger, task } from "@trigger.dev/sdk";
import { createDb } from "@vantera/db";
import { draftConversationMessage, fixConversationMessage, judgeCopy, rankLeads } from "@vantera/agent-brains";
import { runSequenceTouch } from "../pipeline/sequence-touch";
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
    const store = createPgStore(createDb());
    // Phase 2C fast-follow (best-of-N on the responder paths): the global `best_of_n`
    // rollout knob, read once per run; the pipeline core re-caps it and forces it to 1
    // whenever a judge isn't wired — mirrors trigger/copy-draft.ts.
    const bestOfN = await store.getBestOfN();
    const outcome = await runSequenceTouch(payload, {
      store,
      draftFollowupFn: (input) => draftConversationMessage(input),
      fixFollowupFn: (original, input) => fixConversationMessage(original, input),
      judgeFn: (d, c) => judgeCopy(d, c),
      bestOfN,
      now: () => new Date(),
      refreshLead: (accountId, leadId) =>
        runRefreshLead(accountId, leadId, {
          store,
          prospectData: createProspectData(),
          rankFn: (candidates, ctx) => rankLeads(candidates, ctx),
        }),
    });
    logger.info("sequence touch finished", { outcome, runId: payload.runId, stage: payload.stage });
    return { outcome };
  },
});

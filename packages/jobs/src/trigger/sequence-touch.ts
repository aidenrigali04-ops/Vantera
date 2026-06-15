import { logger, task } from "@trigger.dev/sdk";
import { createDb } from "@vantera/db";
import { draftEmail, draftLinkedIn, rankLeads } from "@vantera/agent-brains";
import { runSequenceTouch } from "../pipeline/sequence-touch";
import { createPgStore } from "../pipeline/pg-store";
import { createProspectData } from "../pipeline/prospect-source";
import { runRefreshLead } from "../pipeline/refresh-lead";
import type { SequenceTouchDispatch } from "../pipeline/types";

/**
 * Draft and insert ONE channel touch for the orchestrator (email/linkedin/imessage).
 * Suppression-checked before every draft (rule 11); stops at 'pending_review'/'approved'.
 */
export const sequenceTouch = task({
  id: "sequence-touch",
  maxDuration: 1800,
  run: async (payload: SequenceTouchDispatch) => {
    const store = createPgStore(createDb());
    const outcome = await runSequenceTouch(payload, {
      store,
      draftEmailFn: (input) => draftEmail(input),
      draftLinkedInFn: (input) => draftLinkedIn(input),
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

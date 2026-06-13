import { logger, task } from "@trigger.dev/sdk";
import { createDb } from "@vantera/db";
import { draftCallBrief } from "@vantera/agent-brains";
import { runCallBrief } from "../pipeline/call-brief";
import { createCallBriefStore } from "../pipeline/pg-store";
import type { CallBriefDraftPayload } from "../pipeline/types";

/**
 * Draft per-lead call briefs into the review queue.
 * Suppression-checked before every brief (rule 11); stops at 'pending_review'.
 */
export const callBrief = task({
  id: "call-brief",
  maxDuration: 1800,
  run: async (payload: CallBriefDraftPayload) => {
    const store = createCallBriefStore(createDb());
    const summary = await runCallBrief(payload, {
      store,
      draftBriefFn: (req) => draftCallBrief(req),
    });
    logger.info("call brief finished", { ...summary, callerAgentId: payload.callerAgentId });
    return summary;
  },
});

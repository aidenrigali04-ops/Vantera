import { logger, task } from "@trigger.dev/sdk";
import { createDb } from "@vantera/db";
import { draftEmail, draftLinkedIn } from "@vantera/agent-brains";
import { runCopyDraft } from "../pipeline/copy-draft";
import { createPgStore } from "../pipeline/pg-store";
import type { CopyDraftPayload } from "../pipeline/types";

/**
 * Draft personalized outreach for qualified leads into the review queue.
 * Suppression-checked before every draft (rule 11); stops at 'pending_review' (Phase 5 sends).
 */
export const copyDraft = task({
  id: "copy-draft",
  maxDuration: 1800,
  run: async (payload: CopyDraftPayload) => {
    const store = createPgStore(createDb());
    const summary = await runCopyDraft(payload, {
      store,
      draftEmailFn: (input) => draftEmail(input),
      draftLinkedInFn: (input) => draftLinkedIn(input),
    });
    logger.info("copy draft finished", { ...summary, copyAgentId: payload.copyAgentId });
    return summary;
  },
});

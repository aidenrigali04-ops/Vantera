import { logger, task } from "@trigger.dev/sdk";
import { createDb } from "@vantera/db";
import { draftLinkedIn, fixLinkedInDraft, judgeCopy } from "@vantera/agent-brains";
import { runCopyDraft } from "../pipeline/copy-draft";
import { createPgStore } from "../pipeline/pg-store";
import type { CopyDraftPayload } from "../pipeline/types";

/**
 * Draft personalized outreach for qualified leads into the review queue.
 * Suppression-checked before every draft (rule 11); stops at 'pending_review' (Phase 5 sends).
 */
export const copyDraft = task({
  id: "copy-draft",
  // Per-tenant isolation (rule 13 scale): chained with concurrencyKey=accountId, so a tenant's
  // draft batches serialize (one at a time) while different tenants draft concurrently.
  queue: { concurrencyLimit: 1 },
  maxDuration: 1800,
  run: async (payload: CopyDraftPayload) => {
    const store = createPgStore(createDb());
    // Task 3 (best-of-N): the global `best_of_n` rollout knob, read once per run; the pipeline
    // core re-caps it and forces it to 1 whenever a judge isn't wired.
    const bestOfN = await store.getBestOfN();
    const summary = await runCopyDraft(payload, {
      store,
      draftLinkedInFn: (input) => draftLinkedIn(input),
      fixLinkedInFn: (draft, input) => fixLinkedInDraft(draft, input),
      judgeFn: (draft, ctx) => judgeCopy(draft, ctx),
      bestOfN,
    });
    logger.info("copy draft finished", { ...summary, copyAgentId: payload.copyAgentId });
    return summary;
  },
});

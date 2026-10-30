import { logger, task } from "@trigger.dev/sdk";
import { createDb } from "@vantera/db";
import { withUsage } from "@vantera/ai";
import { draftLinkedIn, draftLinkedInNote, fixLinkedInDraft, judgeCopy } from "@vantera/agent-brains";
import { runCopyDraft } from "../pipeline/copy-draft";
import { createConversationStore, createPgStore } from "../pipeline/pg-store";
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
    const db = createDb();
    const store = createPgStore(db);
    // Task 3 (best-of-N): the global `best_of_n` rollout knob, read once per run; the pipeline
    // core re-caps it and forces it to 1 whenever a judge isn't wired.
    // Message-shape selector: the global `message_shape_auto` rollout knob (default OFF =
    // byte-identical champion), read once per run alongside it.
    // conversation_policy (spec §7.2): "live" drafts the invite note only (the first message is
    // written at acceptance); any other mode keeps the pair. A failed read degrades to "off".
    const [bestOfN, messageShapeAuto, conversationMode] = await Promise.all([
      store.getBestOfN(),
      store.getMessageShapeAuto(),
      createConversationStore(db).getConversationPolicyMode().catch(() => "off" as const),
    ]);
    const { result: summary, usage } = await withUsage(() =>
      runCopyDraft(payload, {
        store,
        draftLinkedInFn: (input) => draftLinkedIn(input),
        conversationMode,
        draftLinkedInNoteFn: (input) => draftLinkedInNote(input),
        fixLinkedInFn: (draft, input) => fixLinkedInDraft(draft, input),
        judgeFn: (draft, ctx) => judgeCopy(draft, ctx),
        bestOfN,
        messageShapeAuto,
      })
    );
    logger.info("copy draft finished", { ...summary, llm: usage, copyAgentId: payload.copyAgentId });
    return summary;
  },
});

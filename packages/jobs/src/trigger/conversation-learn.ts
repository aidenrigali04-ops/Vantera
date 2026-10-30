import { logger, task } from "@trigger.dev/sdk";
import { createDb } from "@vantera/db";
import { runConversationLearn } from "../pipeline/conversation-learn";
import { createConversationStore } from "../pipeline/pg-store";

/**
 * Nightly conversation learner: scores decisions whose 7-day outcome window closed and rebuilds the
 * per-account and global prior rollups. Fired from the agent-scheduler tick with a daily global
 * idempotency key; one run at a time. Sim priors (Task 19) are not wired yet.
 */
export const conversationLearn = task({
  id: "conversation-learn",
  queue: { concurrencyLimit: 1 },
  maxDuration: 900,
  run: async () => {
    const store = createConversationStore(createDb());
    const result = await runConversationLearn({ store, now: () => new Date(), simPriors: undefined, warn: (m, c) => logger.warn(m, c) });
    logger.info("conversation learn", result);
    return result;
  },
});

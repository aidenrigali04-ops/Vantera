import { logger, task, tasks } from "@trigger.dev/sdk";
import { createDb } from "@vantera/db";
import { buildConversationDeps } from "../pipeline/conversation-deps";
import { runFirstMessage } from "../pipeline/first-message";
import { createConversationStore, createPgStore } from "../pipeline/pg-store";

/**
 * First message at acceptance (spec §7.2): connected leads with no message row get their first
 * message written by the conversation core, from the live thread. The `conversation_policy` knob is
 * read once per run; "off" (or a failed read) does nothing. Under shadow / live_replies copy-draft
 * still writes the pair and this scan only logs shadow decisions against the parked message.
 *
 * Fired from the agent-scheduler tick (the schedule quota is full); one run at a time. The scan is
 * idempotent, so no idempotency key is needed.
 */
export const firstMessage = task({
  id: "first-message",
  queue: { concurrencyLimit: 1 },
  maxDuration: 900,
  run: async () => {
    const db = createDb();
    const store = createPgStore(db);
    const conversation = await buildConversationDeps(db, store, await store.getBestOfN());
    const result = await runFirstMessage({
      store: { ...store, ...createConversationStore(db) },
      decide: conversation.deps,
      mode: conversation.mode,
      now: () => new Date(),
    });
    if (result.drafted > 0) {
      // automatic senders' clean first messages are approved — deliver them now, not next tick
      await tasks.trigger("send-dispatch", {});
    }
    logger.info("first message scan", { ...result, mode: conversation.mode });
    return result;
  },
});

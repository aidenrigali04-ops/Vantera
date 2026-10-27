import { logger, task, tasks } from "@trigger.dev/sdk";
import { createDb } from "@vantera/db";
import {
  classifyReply,
  draftConversationMessage,
  fixConversationMessage,
  judgeCopy,
} from "@vantera/agent-brains";
import { createLinkedInInfraFromEnv } from "@vantera/linkedin-infra";
import { handleLinkedInEvent } from "../pipeline/inbound";
import { createPgStore, createThreadSyncStore } from "../pipeline/pg-store";
import { runThreadSync } from "../pipeline/thread-sync";

/**
 * Thread sync: re-reads contacted leads' LinkedIn threads from the provider in rotation and fills
 * in anything the webhook never delivered — a reply nobody saw, a message the user typed natively
 * in LinkedIn — through the same inbound handler as process-inbound (so a missed reply is
 * classified, notified and answered exactly as a live one would be, freshness rules included).
 *
 * Fired from the agent-scheduler tick with an hourly idempotency key (the schedule quota is full);
 * one run at a time.
 */
export const threadSync = task({
  id: "thread-sync",
  queue: { concurrencyLimit: 1 },
  maxDuration: 900,
  run: async () => {
    const db = createDb();
    const store = createPgStore(db);
    const linkedinInfra = createLinkedInInfraFromEnv();
    const bestOfN = await store.getBestOfN();
    const inboundDeps = {
      store,
      linkedinInfra,
      classifyFn: (body: string) => classifyReply(body),
      respondFn: draftConversationMessage,
      fixReplyFn: fixConversationMessage,
      judgeFn: judgeCopy,
      bestOfN,
    };
    const result = await runThreadSync({
      store: createThreadSyncStore(db),
      linkedinInfra,
      handleEvent: (event) => handleLinkedInEvent(event, inboundDeps),
    });
    if (Object.keys(result.outcomes).some((a) => a.endsWith("+responded"))) {
      // a missed reply just got an answer queued — deliver it now, not on the next cron tick
      await tasks.trigger("send-dispatch", {});
    }
    logger.info("thread sync", result as unknown as Record<string, unknown>);
    return result;
  },
});

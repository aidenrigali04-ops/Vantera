import { logger, task } from "@trigger.dev/sdk";
import { createDb } from "@vantera/db";
import { classifyReply, draftConversationMessage, fixConversationMessage } from "@vantera/agent-brains";
import { createLinkedInInfraFromEnv } from "@vantera/linkedin-infra";
import { runInbound } from "../pipeline/inbound";
import { createPgStore } from "../pipeline/pg-store";
import type { InboundPayload } from "../pipeline/types";

/**
 * Routes verified LinkedIn webhook events: replies, connection acceptances, account state.
 * On a genuine, non-terminal reply the active responder drafts the seller's next message with
 * the SAME grounding + humanizer as the outreach copy and queues it for delivery — continuing the
 * conversation toward close (auto-sent in 'automatic' mode, queued for review otherwise).
 */
export const processInbound = task({
  id: "process-inbound",
  maxDuration: 600,
  run: async (payload: InboundPayload) => {
    const store = createPgStore(createDb());
    const summary = await runInbound(payload, {
      store,
      linkedinInfra: createLinkedInInfraFromEnv(),
      classifyFn: (body) => classifyReply(body),
      respondFn: (input) => draftConversationMessage(input),
      fixReplyFn: (original, input) => fixConversationMessage(original, input),
    });
    logger.info("inbound processed", { source: payload.source, ...summary });
    return summary;
  },
});

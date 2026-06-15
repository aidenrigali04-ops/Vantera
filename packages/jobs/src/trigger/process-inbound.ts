import { logger, task } from "@trigger.dev/sdk";
import { createDb } from "@vantera/db";
import { classifyReply } from "@vantera/agent-brains";
import { createEmailInfraFromEnv } from "@vantera/email-infra";
import { createMessageInfraFromEnv } from "@vantera/imessage-infra";
import { createLinkedInInfraFromEnv } from "@vantera/linkedin-infra";
import { runInbound } from "../pipeline/inbound";
import { createPgStore } from "../pipeline/pg-store";
import type { InboundPayload } from "../pipeline/types";

/** Routes verified webhook events: replies, bounces, unsubscribes, LinkedIn state. */
export const processInbound = task({
  id: "process-inbound",
  maxDuration: 600,
  run: async (payload: InboundPayload) => {
    const store = createPgStore(createDb());
    const summary = await runInbound(payload, {
      store,
      emailInfra: createEmailInfraFromEnv(),
      linkedinInfra: createLinkedInInfraFromEnv(),
      messageInfra: createMessageInfraFromEnv(),
      classifyFn: (body) => classifyReply(body),
    });
    logger.info("inbound processed", { source: payload.source, ...summary });
    return summary;
  },
});

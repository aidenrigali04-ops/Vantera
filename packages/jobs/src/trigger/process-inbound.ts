import { logger, task } from "@trigger.dev/sdk";
import { createDb } from "@vantera/db";
import { classifyReply } from "@vantera/agent-brains";
import { createLinkedInInfraFromEnv } from "@vantera/linkedin-infra";
import { runInbound } from "../pipeline/inbound";
import { createPgStore } from "../pipeline/pg-store";
import type { InboundPayload } from "../pipeline/types";

/** Routes verified LinkedIn webhook events: replies, connection acceptances, account state. */
export const processInbound = task({
  id: "process-inbound",
  maxDuration: 600,
  run: async (payload: InboundPayload) => {
    const store = createPgStore(createDb());
    const summary = await runInbound(payload, {
      store,
      linkedinInfra: createLinkedInInfraFromEnv(),
      classifyFn: (body) => classifyReply(body),
    });
    logger.info("inbound processed", { source: payload.source, ...summary });
    return summary;
  },
});

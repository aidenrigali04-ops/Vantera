import { logger, task } from "@trigger.dev/sdk";
import { createDb } from "@vantera/db";
import { classifyOutcome } from "@vantera/agent-brains";
import { createVoiceInfraFromEnv } from "@vantera/voice-infra";
import { runVoiceInbound } from "../pipeline/voice-inbound";
import { createVoiceInboundStore } from "../pipeline/pg-store";

/** Routes inbound voice webhook events: call started, ended, outcome classification. */
export const processVoiceWebhook = task({
  id: "process-voice-webhook",
  maxDuration: 600,
  run: async (payload: { payload: unknown }) => {
    const store = createVoiceInboundStore(createDb());
    const summary = await runVoiceInbound(payload.payload, {
      store,
      voiceInfra: createVoiceInfraFromEnv(),
      classifyFn: (t) => classifyOutcome(t),
    });
    logger.info("voice webhook processed", { ...summary });
    return summary;
  },
});

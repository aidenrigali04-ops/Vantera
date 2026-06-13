import { logger, schedules } from "@trigger.dev/sdk";
import { createDb } from "@vantera/db";
import { createVoiceInfraFromEnv } from "@vantera/voice-infra";
import { runCallDispatch } from "../pipeline/call-dispatch";
import { createCallDispatchStore } from "../pipeline/pg-store";

/** The call dispatch cron: claims approved call briefs and places live dial attempts. */
export const callDispatch = schedules.task({
  id: "call-dispatch",
  cron: "*/5 * * * *",
  run: async () => {
    const store = createCallDispatchStore(createDb());
    const results = await runCallDispatch({
      store,
      voiceInfra: createVoiceInfraFromEnv(),
      fromNumber: process.env.VOICE_FROM_NUMBER ?? "",
    });
    logger.info("call dispatch tick", { total: results.length });
    return results;
  },
});

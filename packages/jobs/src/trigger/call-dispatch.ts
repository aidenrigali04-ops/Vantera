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
    if (results.length === 1 && results[0]?.outcome === "no_caller_number") {
      logger.error("call-dispatch: VOICE_FROM_NUMBER is not set — no calls placed", {});
    }
    logger.info("call dispatch tick", { total: results.length });
    return results;
  },
});

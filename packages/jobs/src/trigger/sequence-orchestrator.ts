import { logger, schedules, tasks } from "@trigger.dev/sdk";
import { createDb } from "@vantera/db";
import { createPgStore } from "../pipeline/pg-store";
import { runSequenceTick } from "../pipeline/sequence-orchestrate";

/**
 * Per-lead sequence state machine, every 15 min (mirrors agent-scheduler). The orchestration
 * logic lives in the pipeline core (sequence-orchestrate); this wrapper injects the real store
 * and the Trigger task dispatchers. The core owns the x2 caller cadence via run.callAttempts.
 */
export const sequenceOrchestrator = schedules.task({
  id: "sequence-orchestrator",
  cron: "*/15 * * * *",
  run: async () => {
    const store = createPgStore(createDb());
    const summary = await runSequenceTick({
      store,
      now: new Date(),
      dispatch: {
        dispatchTouch: async (payload) => {
          await tasks.trigger("sequence-touch", payload);
        },
        dispatchCallBrief: async (payload) => {
          await tasks.trigger("call-brief", payload);
        },
      },
    });
    logger.info("sequence orchestrator tick", summary);
    return summary;
  },
});

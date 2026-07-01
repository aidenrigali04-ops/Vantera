import { logger, schedules } from "@trigger.dev/sdk";
import { createDb } from "@vantera/db";
import { createPgStore } from "../pipeline/pg-store";
import { runOptimize } from "../pipeline/optimize";

/**
 * Daily: evaluate running experiments and conclude the decisive ones (Phase 3, suggest-only). A
 * proven winner is parked at 'ready_to_adopt' for the owner; a harmful challenger is halted and a
 * losing one discarded (both revert to the champion). Never adopts on its own.
 */
export const optimize = schedules.task({
  id: "optimize",
  cron: "0 6 * * *",
  run: async () => {
    const summary = await runOptimize({ store: createPgStore(createDb()) });
    logger.info("optimize finished", { ...summary });
    return summary;
  },
});

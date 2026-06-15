import { logger, schedules } from "@trigger.dev/sdk";
import { createDb } from "@vantera/db";
import { createPgStore } from "../pipeline/pg-store";
import { runTrialExpiry } from "../pipeline/trial-expiry";

/** Daily: lapse no-card free trials past their end date (0019) → gate re-blocks, outreach pauses. */
export const trialExpiry = schedules.task({
  id: "trial-expiry",
  cron: "0 5 * * *",
  run: async () => {
    const summary = await runTrialExpiry({ store: createPgStore(createDb()) });
    logger.info("trial expiry finished", { ...summary });
    return summary;
  },
});

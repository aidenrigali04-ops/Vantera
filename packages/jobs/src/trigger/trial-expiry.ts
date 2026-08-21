import { logger, schedules } from "@trigger.dev/sdk";
import { createDb } from "@vantera/db";
import { createLifecycleStore, createPgStore } from "../pipeline/pg-store";
import { runTrialExpiry } from "../pipeline/trial-expiry";

/** Daily: lapse no-card free trials past their end date (0019) → gate re-blocks, outreach pauses.
 *  Lapsing accounts are also captured as lifecycle trial_lapsed touches (0045). */
export const trialExpiry = schedules.task({
  id: "trial-expiry",
  cron: "0 5 * * *",
  run: async () => {
    const db = createDb();
    const summary = await runTrialExpiry({ store: createPgStore(db), lifecycle: createLifecycleStore(db) });
    logger.info("trial expiry finished", { ...summary });
    return summary;
  },
});

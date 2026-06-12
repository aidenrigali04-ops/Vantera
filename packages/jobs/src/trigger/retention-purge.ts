import { logger, schedules } from "@trigger.dev/sdk";
import { createDb } from "@vantera/db";
import { createPgStore } from "../pipeline/pg-store";
import { runRetentionPurge } from "../pipeline/retention-purge";

/** Daily GDPR-hygiene purge: never-qualified prospects past the 90-day window (0002, rule 11). */
export const retentionPurge = schedules.task({
  id: "retention-purge",
  cron: "0 4 * * *",
  run: async () => {
    const summary = await runRetentionPurge({ store: createPgStore(createDb()) });
    logger.info("retention purge finished", { ...summary });
    return summary;
  },
});

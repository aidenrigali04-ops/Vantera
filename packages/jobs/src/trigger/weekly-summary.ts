import { logger, schedules } from "@trigger.dev/sdk";
import { createDb } from "@vantera/db";
import { createTransactionalEmailFromEnv } from "@vantera/transactional-email";
import { runWeeklySummary } from "../pipeline/weekly-summary";
import { createWeeklySummaryStore } from "../pipeline/pg-store";

/**
 * Monday recap: what the agents did this week, mailed to each account's owners/admins
 * (retention: auto-sent summaries beat dashboards). Opt-out lives on the account
 * (weekly_summary_enabled, 0042) and is honored in the core; dead weeks send nothing.
 * Product notification via the transactional lane — never cold outreach (rule 11 N/A).
 */
export const weeklySummary = schedules.task({
  id: "weekly-summary",
  cron: "0 14 * * 1",
  run: async () => {
    const mailer = createTransactionalEmailFromEnv();
    const outcome = await runWeeklySummary({
      store: createWeeklySummaryStore(createDb()),
      send: async (message) => {
        await mailer.send(message);
      },
      appUrl: process.env.APP_URL || "https://www.vanterasystem.dev",
    });
    logger.info("weekly summary finished", { ...outcome });
    return outcome;
  },
});

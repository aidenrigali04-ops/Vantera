import { logger, schedules, tasks } from "@trigger.dev/sdk";
import { createDb } from "@vantera/db";
import { createCrmPushStore } from "../pipeline/pg-store";

/**
 * Re-drives CRM push events whose backoff has elapsed (status='pending' with a due
 * next_retry_at). Fresh events are pushed directly by the close/manual-push actions;
 * this cron only picks up retryable failures. Schedule + backoff state lives in our DB.
 */
export const crmPushRetry = schedules.task({
  id: "crm-push-retry",
  cron: "*/5 * * * *",
  run: async () => {
    const store = createCrmPushStore(createDb());
    const due = await store.dueEventIds(new Date(), 100);
    for (const eventId of due) {
      await tasks.trigger("crm-push", { eventId });
    }
    logger.info("crm push retry tick", { due: due.length });
    return { triggered: due.length };
  },
});

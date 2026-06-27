import { logger, schedules } from "@trigger.dev/sdk";
import { createDb } from "@vantera/db";
import { runAccountDeletion } from "../pipeline/account-deletion";
import { createAccountDeletionStore } from "../pipeline/pg-store";

/**
 * Rule 11 GDPR deletion path: hard delete (FK cascades wipe all tenant data). Uses the shared
 * Drizzle/postgres-js client (createDb) like every other task — NOT @supabase/supabase-js, whose
 * realtime client needs a native WebSocket the Trigger.dev Node-21 runtime lacks. supabase-js
 * threw at client construction, failing this cron on every attempt; the guardrail in
 * structure.test.ts now forbids that import in any trigger task.
 */
export const processAccountDeletion = schedules.task({
  id: "process-account-deletion",
  cron: "0 3 * * *",
  run: async () => {
    const store = createAccountDeletionStore(createDb());
    const summary = await runAccountDeletion({
      store,
      onError: (accountId, error) =>
        logger.error("account hard-delete failed", {
          accountId,
          error: error instanceof Error ? error.message : String(error),
        }),
    });
    logger.info("account deletion sweep", { ...summary });
    return summary;
  },
});

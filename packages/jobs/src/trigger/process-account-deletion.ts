import { logger, schedules } from "@trigger.dev/sdk";
import { createDb } from "@vantera/db";
import { createLinkedInInfraFromEnv } from "@vantera/linkedin-infra";
import { runAccountDeletion } from "../pipeline/account-deletion";
import { createAccountDeletionStore } from "../pipeline/pg-store";

/**
 * Rule 11 GDPR deletion path: disconnect the tenant's provider connections (so no platform usage
 * keeps billing for a deleted account), then hard delete (FK cascades wipe all tenant data). Uses
 * the shared Drizzle/postgres-js client (createDb) like every other task — NOT @supabase/supabase-js,
 * whose realtime client needs a native WebSocket the Trigger.dev Node-21 runtime lacks (it threw at
 * construction, failing this cron); the structure.test.ts guardrail forbids that import.
 */
export const processAccountDeletion = schedules.task({
  id: "process-account-deletion",
  cron: "0 3 * * *",
  run: async () => {
    const store = createAccountDeletionStore(createDb());
    const linkedin = createLinkedInInfraFromEnv();
    const summary = await runAccountDeletion({
      store,
      disconnectLinkedIn: (ref) => linkedin.deleteConnectedAccount(ref),
      onError: (accountId, error) =>
        logger.error("account deletion step failed", {
          accountId,
          error: error instanceof Error ? error.message : String(error),
        }),
    });
    logger.info("account deletion sweep", { ...summary });
    return summary;
  },
});

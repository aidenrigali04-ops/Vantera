import { logger, task } from "@trigger.dev/sdk";
import { createDb } from "@vantera/db";
import { createLinkedInInfraFromEnv } from "@vantera/linkedin-infra";
import { runSyncConnections } from "../pipeline/sync-connections";
import { createPgStore } from "../pipeline/pg-store";

/**
 * Backfill missed connection acceptances for one account: mark invited leads that are now 1st-degree
 * connections as connected, so their parked follow-up message fires. Run after a webhook outage that
 * dropped new_relation events. The dispatcher (send-dispatch cron) sends the follow-ups from there.
 */
export const syncConnections = task({
  id: "sync-connections",
  maxDuration: 300,
  run: async (payload: { accountId: string }) => {
    const result = await runSyncConnections({
      store: createPgStore(createDb()),
      linkedinInfra: createLinkedInInfraFromEnv(),
      accountId: payload.accountId,
    });
    logger.info("sync-connections", result as unknown as Record<string, unknown>);
    return result;
  },
});

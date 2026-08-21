import { logger, schedules } from "@trigger.dev/sdk";
import { createDb } from "@vantera/db";
import { getConnector, encryptToken, decryptToken, type CrmProvider } from "@vantera/crm-infra";
import { runCrmActivitySync } from "../pipeline/crm-activity-sync";
import { createCrmActivityStore } from "../pipeline/pg-store";

/**
 * Logs LinkedIn touches (outreach sent, replies, meetings booked) as timeline notes on
 * the customer's CRM contacts — for connections that opted into activity sync. Logic
 * lives in the core; watermark state lives on the connection config, so a tick is
 * idempotent and a missed tick just catches up on the next one.
 */
export const crmActivitySync = schedules.task({
  id: "crm-activity-sync",
  cron: "*/15 * * * *",
  run: async () => {
    const outcome = await runCrmActivitySync({
      store: createCrmActivityStore(createDb()),
      getConnector: (provider: CrmProvider) => getConnector(provider),
      decrypt: (enc) => decryptToken(enc),
      encrypt: (plain) => encryptToken(plain),
    });
    logger.info("crm activity sync tick", { ...outcome });
    return outcome;
  },
});

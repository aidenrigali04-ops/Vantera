import { logger, task } from "@trigger.dev/sdk";
import { createDb } from "@vantera/db";
import { getConnector, encryptToken, decryptToken, type CrmProvider } from "@vantera/crm-infra";
import { runCrmPush } from "../pipeline/crm-push";
import { createCrmPushStore } from "../pipeline/pg-store";

/** One closed-won push to a customer CRM/notify destination. Logic lives in the core. */
export const crmPush = task({
  id: "crm-push",
  maxDuration: 120,
  run: async (payload: { eventId: string }) => {
    const store = createCrmPushStore(createDb());
    const outcome = await runCrmPush(payload.eventId, {
      store,
      getConnector: (provider: CrmProvider) => getConnector(provider),
      decrypt: (enc) => decryptToken(enc),
      encrypt: (plain) => encryptToken(plain),
    });
    logger.info("crm push finished", { eventId: payload.eventId, outcome });
    return { outcome };
  },
});

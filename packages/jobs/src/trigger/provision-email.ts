import { logger, task } from "@trigger.dev/sdk";
import { createDb } from "@vantera/db";
import { createEmailInfraFromEnv } from "@vantera/email-infra";
import { runProvisionEmail, type ProvisionEmailPayload } from "../pipeline/provision-email";
import { createPgStore } from "../pipeline/pg-store";

/** Durable email provisioning (domain + N mailboxes). Long, retryable work — never in a route (rule 10). */
export const provisionEmail = task({
  id: "provision-email",
  maxDuration: 600,
  run: async (payload: ProvisionEmailPayload) => {
    const store = createPgStore(createDb());
    const outcome = await runProvisionEmail(payload, { store, emailInfra: createEmailInfraFromEnv() });
    logger.info("email provisioned", { accountId: payload.accountId, ...outcome });
    return outcome;
  },
});

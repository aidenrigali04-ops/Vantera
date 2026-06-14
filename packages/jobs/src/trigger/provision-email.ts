import { logger, task } from "@trigger.dev/sdk";
import { createDb } from "@vantera/db";
import { createEmailInfraFromEnv } from "@vantera/email-infra";
import { runProvisionEmail } from "../pipeline/provision-email";
import { createPgStore } from "../pipeline/pg-store";

export const provisionEmail = task({
  id: "provision-email",
  run: async (payload: { accountId: string; domainCount: number; mailboxesPerDomain: number }) => {
    const store = createPgStore(createDb());
    const summary = await runProvisionEmail({ store, emailInfra: createEmailInfraFromEnv() }, payload);
    logger.info("email provisioning complete", { accountId: payload.accountId, ...summary });
    return summary;
  },
});

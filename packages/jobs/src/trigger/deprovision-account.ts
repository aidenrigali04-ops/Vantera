import { logger, task } from "@trigger.dev/sdk";
import { createDb } from "@vantera/db";
import { MaildosoApiClient } from "@vantera/email-infra";
import { createPgStore } from "../pipeline/pg-store";
import { runDeprovisionAccount } from "../pipeline/deprovision";

/** Delete the account's Maildoso mailboxes + release its domains, then purge local rows/secrets.
 *  Triggered on account deletion and on billing cancellation (zero-mailbox-entitlement path). */
export const deprovisionAccount = task({
  id: "deprovision-account",
  maxDuration: 300,
  run: async (payload: { accountId: string }) => {
    const store = createPgStore(createDb());
    const api = new MaildosoApiClient({ apiKey: process.env.MAILDOSO_API_KEY! });
    await runDeprovisionAccount(payload, { api, store });
    logger.info("account email deprovisioned", { accountId: payload.accountId });
  },
});

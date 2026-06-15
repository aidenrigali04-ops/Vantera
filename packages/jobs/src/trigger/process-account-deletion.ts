import { logger, schedules } from "@trigger.dev/sdk";
import { createClient } from "@supabase/supabase-js";
import { createDb } from "@vantera/db";
import { MaildosoApiClient } from "@vantera/email-infra";
import { isEligibleForDeletion } from "../lib/deletion";
import { createPgStore } from "../pipeline/pg-store";
import { runDeprovisionAccount } from "../pipeline/deprovision";

function serviceClient() {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set");
  return createClient(url, key, { auth: { persistSession: false } });
}

/** Rule 11 deletion path: vendor cleanup, then hard delete (FK cascades wipe all tenant data). */
export const processAccountDeletion = schedules.task({
  id: "process-account-deletion",
  cron: "0 3 * * *",
  run: async () => {
    const supabase = serviceClient();
    const now = new Date();

    const { data: requests, error } = await supabase
      .from("account_deletion_requests")
      .select("id, account_id, created_at")
      .eq("status", "pending");
    if (error) throw new Error(`failed to list deletion requests: ${error.message}`);

    let processed = 0;
    for (const request of requests ?? []) {
      if (!isEligibleForDeletion(new Date(request.created_at), now)) continue;

      await supabase
        .from("account_deletion_requests")
        .update({ status: "vendor_cleanup" })
        .eq("id", request.id);

      // Deprovision email mailboxes + release domains BEFORE the hard delete — the FK cascade
      // wipes the mailbox rows, so the provider-side deletion must read them first (rule 11
      // vendor deletion + COGS). Awaited inline, not fire-and-forget. On failure, revert the
      // request to pending so the next cron retries rather than orphaning provider mailboxes.
      try {
        await runDeprovisionAccount(
          { accountId: request.account_id },
          {
            api: new MaildosoApiClient({ apiKey: process.env.MAILDOSO_API_KEY ?? "" }),
            store: createPgStore(createDb()),
          }
        );
      } catch (err) {
        logger.error("email deprovision failed; reverting to pending for retry", {
          accountId: request.account_id,
          error: err instanceof Error ? err.message : String(err),
        });
        await supabase
          .from("account_deletion_requests")
          .update({ status: "pending" })
          .eq("id", request.id);
        continue;
      }
      logger.info("email deprovisioned", { accountId: request.account_id });

      const { error: deleteError } = await supabase
        .from("accounts")
        .delete()
        .eq("id", request.account_id);
      if (deleteError) {
        logger.error("account hard-delete failed", {
          accountId: request.account_id,
          error: deleteError.message,
        });
        continue;
      }
      processed += 1;
      logger.info("account deleted", { accountId: request.account_id });
    }
    return { processed };
  },
});

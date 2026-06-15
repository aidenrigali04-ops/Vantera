import { logger, schedules, tasks } from "@trigger.dev/sdk";
import { createClient } from "@supabase/supabase-js";
import { isEligibleForDeletion } from "../lib/deletion";

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

      // Deprovision email mailboxes + release domains before the hard delete.
      await tasks.trigger("deprovision-account", { accountId: request.account_id });
      logger.info("deprovision-account triggered", { accountId: request.account_id });

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

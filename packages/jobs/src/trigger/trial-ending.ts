import { logger, schedules } from "@trigger.dev/sdk";
import { createDb } from "@vantera/db";
import { sendTrialEndingEmail } from "@vantera/transactional-email";
import { createTrialEndingStore } from "../pipeline/pg-store";
import { runTrialEnding } from "../pipeline/trial-ending";

/** Daily (R5): one honest heads-up ~2 days before a trial lapses — idempotence-stamped, so an
 *  account is emailed once per trial. No-ops silently until RESEND creds exist in this env. */
export const trialEnding = schedules.task({
  id: "trial-ending",
  cron: "0 14 * * *",
  run: async () => {
    const db = createDb();
    const appUrl = process.env.APP_URL ?? "https://www.vanterasystem.dev";
    const summary = await runTrialEnding({
      store: createTrialEndingStore(db),
      send: ({ to, daysLeft }) => sendTrialEndingEmail({ to, daysLeft, appUrl }),
    });
    logger.info("trial-ending finished", { ...summary });
    return summary;
  },
});

import { logger, task } from "@trigger.dev/sdk";
import { createDb } from "@vantera/db";
import { sendTrialEndingEmail } from "@vantera/transactional-email";
import { createTrialEndingStore } from "../pipeline/pg-store";
import { runTrialEnding } from "../pipeline/trial-ending";

/**
 * R5: one honest heads-up ~2 days before a trial lapses — idempotence-stamped
 * (trial_ending_notified_at), so an account is emailed once per trial. No-ops silently
 * until RESEND creds exist in this env.
 *
 * A plain task fired from the agent-scheduler tick (every 15 min), NOT its own cron: the
 * Trigger plan's schedule quota is fully used (10/10 — shipping this as an 11th schedule
 * broke every prod deploy from 2026-07-15 09:57Z until the 07-16 conversion). The stamp
 * makes the tick cadence safe, and the email lands at the first tick after an account
 * crosses the 2-days-left threshold instead of a daily batch.
 */
export const trialEnding = task({
  id: "trial-ending",
  maxDuration: 300,
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

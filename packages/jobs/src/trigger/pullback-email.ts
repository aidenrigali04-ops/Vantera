import { logger, task } from "@trigger.dev/sdk";
import { createDb } from "@vantera/db";
import { sendPullbackEmail, signUnsubscribeToken } from "@vantera/transactional-email";
import { createPullbackStore } from "../pipeline/pg-store";
import { runPullback } from "../pipeline/pullback";

/**
 * Pull-back email (spec 2026-07-18): the leads or drafts already waiting, named, at most twice.
 *
 * A plain task fired from the agent-scheduler tick, NOT its own cron — the Trigger plan's
 * schedule quota is fully used (10/10; an 11th broke every prod deploy 2026-07-15). Ledger rows
 * in lifecycle_touches make the 15-min tick cadence safe. No-ops silently until RESEND creds
 * exist in this env.
 */
export const pullbackEmail = task({
  id: "pullback-email",
  maxDuration: 300,
  run: async () => {
    const db = createDb();
    const appUrl = process.env.APP_URL ?? "https://www.vanterasystem.dev";
    const summary = await runPullback({
      store: createPullbackStore(db),
      appUrl,
      send: async (message) => {
        await sendPullbackEmail({
          to: message.to,
          subject: message.subject,
          lines: message.lines,
          ctaLabel: message.ctaLabel,
          ctaUrl: message.ctaUrl,
          // Sign the USER id, not the address — Task 6's route resolves a user to an account.
          unsubscribeUrl: `${appUrl}/api/lifecycle-unsubscribe/${signUnsubscribeToken(message.userId)}`,
        });
      },
    });
    logger.info("pullback-email finished", { ...summary });
    return summary;
  },
});

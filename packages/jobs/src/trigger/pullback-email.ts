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
 * in lifecycle_touches make the 15-min tick cadence safe. It does NOT no-op silently when RESEND
 * creds or LIFECYCLE_UNSUBSCRIBE_SECRET are missing from this env — send() throws for every
 * recipient, caught per-recipient in runPullback, which is why the ERROR-level branch below
 * exists: `touched: 0, emailsSent: 0` alone is indistinguishable from "no candidates found".
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
    if (isPullbackMisconfigured(summary)) {
      // Every attempted send failed and none landed — the signature of a totally broken env
      // (missing RESEND_API_KEY/RESEND_FROM_EMAIL or LIFECYCLE_UNSUBSCRIBE_SECRET), not one bad
      // address. Logged at ERROR so this alerts instead of reading as a quiet no-candidates tick.
      logger.error("pullback-email: every send failed — check RESEND/LIFECYCLE_UNSUBSCRIBE_SECRET env", {
        ...summary,
      });
    } else {
      logger.info("pullback-email finished", { ...summary });
    }
    return summary;
  },
});

/**
 * Exported for a colocated unit test (pullback-email.test.ts) — trigger wrappers wire real deps
 * (rule 13) and normally aren't unit-tested directly, so this decision is kept as a small pure
 * predicate rather than inlined, the same way the counter it reads is kept pure in pullback.ts.
 */
export function isPullbackMisconfigured(summary: {
  sendFailures: number;
  emailsSent: number;
}): boolean {
  return summary.sendFailures > 0 && summary.emailsSent === 0;
}

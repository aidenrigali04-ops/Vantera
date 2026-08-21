import { logger, task } from "@trigger.dev/sdk";
import { createDb } from "@vantera/db";
import { createLinkedInInfraFromEnv } from "@vantera/linkedin-infra";
import { createTransactionalEmailFromEnv } from "@vantera/transactional-email";
import { runAccountHealth } from "../pipeline/account-health";
import { createAccountHealthStore } from "../pipeline/pg-store";

/**
 * LinkedIn connection health reconcile: the provider's live account list is the truth;
 * stale rows are reconciled so a dead session pauses the pipeline cleanly AND surfaces to
 * the user (banner + admin alert). Exists because a real disconnect once sat invisible
 * for two days behind a stale 'active' row (2026-07-08 incident) — the status webhook
 * alone is not a reliable signal.
 *
 * A plain task fired from the agent-scheduler tick (every 15 min), NOT its own cron: the
 * Trigger plan's schedule quota is fully used (10/10 — adding an 11th failed the deploy),
 * and the reconcile has no timing needs a piggybacked tick doesn't satisfy.
 */
export const accountHealth = task({
  id: "account-health",
  maxDuration: 300,
  run: async () => {
    const mailer = createTransactionalEmailFromEnv();
    const summary = await runAccountHealth({
      store: createAccountHealthStore(createDb()),
      linkedin: createLinkedInInfraFromEnv(),
      send: async (alert) => {
        await mailer.send(alert);
      },
      appUrl: process.env.APP_URL || "https://www.vanterasystem.dev",
    });
    if (summary.reconciled > 0) {
      logger.warn("account health: connection status reconciled", { ...summary });
    } else {
      logger.info("account health tick", { ...summary });
    }
    return summary;
  },
});

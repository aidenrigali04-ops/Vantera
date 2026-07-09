import { logger, task } from "@trigger.dev/sdk";
import { createDb } from "@vantera/db";
import { createLinkedInInfraFromEnv } from "@vantera/linkedin-infra";
import { createTransactionalEmailFromEnv } from "@vantera/transactional-email";
import { runLifecycleOutreach } from "../pipeline/lifecycle-outreach";
import { createLifecycleStore } from "../pipeline/pg-store";

/**
 * Operator-side lifecycle re-engagement (0045): founder DMs to stalled-onboarding, idle,
 * and trial-lapsed users, sent from the founder's own LinkedIn identity. Fired from the
 * agent-scheduler tick (the Trigger schedule quota is 10/10, same reason as account-health);
 * the core's own gates (enabled flag, kill switch, business-hours window, once-a-day run
 * gate) make the 15-minute firing a cheap no-op.
 */
export const lifecycleOutreach = task({
  id: "lifecycle-outreach",
  maxDuration: 3600, // paced sends: up to cap × ~2min jittered gaps
  run: async () => {
    const mailer = createTransactionalEmailFromEnv();
    const summary = await runLifecycleOutreach({
      store: createLifecycleStore(createDb()),
      linkedin: createLinkedInInfraFromEnv(),
      send: async (alert) => {
        await mailer.send(alert);
      },
      pause: (ms) => new Promise((resolve) => setTimeout(resolve, ms)),
    });
    logger.info("lifecycle outreach tick", { ...summary });
    return summary;
  },
});

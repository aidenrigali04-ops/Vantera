import { logger, task, tasks } from "@trigger.dev/sdk";
import { createDb } from "@vantera/db";
import { createLinkedInInfraFromEnv } from "@vantera/linkedin-infra";
import { runOutreachSend } from "../pipeline/outreach-send";
import { createPgStore } from "../pipeline/pg-store";

/** One live LinkedIn send; suppression re-checked at the boundary (rule 11). */
export const outreachSend = task({
  id: "outreach-send",
  maxDuration: 300,
  run: async (payload: { sendId: string }) => {
    const store = createPgStore(createDb());
    const outcome = await runOutreachSend(payload, {
      store,
      linkedinInfra: createLinkedInInfraFromEnv(),
      onProviderError: (detail) => logger.error("outreach send provider error", { sendId: payload.sendId, detail }),
    });
    if (outcome === "sender_disconnected") {
      // The sender's LinkedIn session is dead — reconcile NOW so the status flips, the
      // dashboard banner shows, and the admins get the alert within minutes (not on the
      // next scheduled tick). The send itself parked and retries after reconnect.
      logger.error("outreach send: sender LinkedIn connection is dead — health check triggered", {
        sendId: payload.sendId,
      });
      await tasks.trigger("account-health", {});
    } else {
      logger.info("outreach send finished", { sendId: payload.sendId, outcome });
    }
    return { outcome };
  },
});

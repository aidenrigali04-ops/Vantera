import { logger, task } from "@trigger.dev/sdk";
import { createDb } from "@vantera/db";
import { createEmailInfraFromEnv } from "@vantera/email-infra";
import { createLinkedInInfraFromEnv } from "@vantera/linkedin-infra";
import { runOutreachSend } from "../pipeline/outreach-send";
import { createPgStore } from "../pipeline/pg-store";

/** One live send; suppression re-checked at the boundary (rule 11). */
export const outreachSend = task({
  id: "outreach-send",
  maxDuration: 300,
  run: async (payload: { sendId: string }) => {
    const store = createPgStore(createDb());
    const outcome = await runOutreachSend(payload, {
      store,
      emailInfra: createEmailInfraFromEnv(),
      linkedinInfra: createLinkedInInfraFromEnv(),
      // APP_URL is the Trigger.dev-side name; NEXT_PUBLIC_APP_URL covers local dev sharing one .env
      appUrl: process.env.APP_URL ?? process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000",
    });
    logger.info("outreach send finished", { sendId: payload.sendId, outcome });
    return { outcome };
  },
});

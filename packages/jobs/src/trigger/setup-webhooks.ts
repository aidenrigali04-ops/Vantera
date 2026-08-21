import { logger, task } from "@trigger.dev/sdk";
import { createLinkedInInfraFromEnv } from "@vantera/linkedin-infra";
import { runSetupWebhooks } from "../pipeline/setup-webhooks";

/**
 * One-off ops task: (re)register the Unipile LinkedIn webhook(s) with the correct verify secret,
 * so acceptance (new_relation) and reply (message_received) events stop being rejected. Trigger
 * manually from the dashboard/MCP; the result is logged for verification.
 */
export const setupLinkedinWebhooks = task({
  id: "setup-linkedin-webhooks",
  maxDuration: 120,
  run: async () => {
    const result = await runSetupWebhooks({
      linkedinInfra: createLinkedInInfraFromEnv(),
      appUrl: process.env.APP_URL ?? "",
    });
    logger.info("linkedin webhook setup", result as unknown as Record<string, unknown>);
    return result;
  },
});

import type { LinkedInInfra, WebhookSetupResult } from "@vantera/linkedin-infra";

export interface SetupWebhooksDeps {
  linkedinInfra: Pick<LinkedInInfra, "setupWebhook">;
  /** The public prod web origin where /api/webhooks/linkedin lives — never a localhost default. */
  appUrl: string;
}

/**
 * (Re)register the LinkedIn inbound webhook at `<appUrl>/api/webhooks/linkedin` with the shared
 * secret our route verifies. Run after a secret/URL drift leaves the provider's webhook failing
 * signature verification (which silently kills acceptance + reply processing). Idempotent.
 */
export async function runSetupWebhooks(deps: SetupWebhooksDeps): Promise<WebhookSetupResult> {
  const base = deps.appUrl.replace(/\/+$/, "");
  if (!base || base.includes("localhost")) {
    throw new Error(`APP_URL must be the public prod origin, got: "${deps.appUrl}"`);
  }
  return deps.linkedinInfra.setupWebhook(`${base}/api/webhooks/linkedin`);
}

import type { LinkedInInfra, WebhookSetupResult } from "@vantera/linkedin-infra";

export interface SetupWebhooksDeps {
  linkedinInfra: Pick<LinkedInInfra, "setupWebhook" | "probeWebhook">;
  /** The public prod web origin where /api/webhooks/linkedin lives — never a localhost default. */
  appUrl: string;
}

/** Setup result plus a self-test that proves the secret matches what the route verifies. */
export type SetupWebhooksOutcome = WebhookSetupResult & {
  probe: { status: number; verified: boolean };
};

/**
 * (Re)register the LinkedIn inbound webhook at `<appUrl>/api/webhooks/linkedin` with the shared
 * secret our route verifies, then self-test the route with that secret. Run after a secret/URL
 * drift leaves the provider's webhook failing signature verification (which silently kills
 * acceptance + reply processing). The probe confirms the fix without waiting on the provider to
 * deliver a real event. Idempotent.
 */
export async function runSetupWebhooks(deps: SetupWebhooksDeps): Promise<SetupWebhooksOutcome> {
  // Force https: the endpoint is on Vercel, which 308-redirects http→https, and that redirect
  // can drop the POST body / secret header — so an http webhook silently never delivers. (APP_URL
  // is currently set to http:// in the runtime env; normalize defensively rather than depend on it.)
  const base = deps.appUrl.replace(/\/+$/, "").replace(/^http:\/\//i, "https://");
  if (!base || base.includes("localhost")) {
    throw new Error(`APP_URL must be the public prod origin, got: "${deps.appUrl}"`);
  }
  const url = `${base}/api/webhooks/linkedin`;
  const result = await deps.linkedinInfra.setupWebhook(url);
  const probe = await deps.linkedinInfra.probeWebhook(url);
  return { ...result, probe };
}

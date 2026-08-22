import type { HostedAuthRedirects } from "@vantera/linkedin-infra";

/** Build the hosted-auth return URLs from the app base url (APP_URL). */
export function buildConnectRedirects(appUrl: string): HostedAuthRedirects {
  if (!appUrl) throw new Error("APP_URL is not set");
  const base = appUrl.replace(/\/+$/, "");
  return {
    success: `${base}/settings/senders?connected=1`,
    failure: `${base}/settings/senders?connected=failed`,
  };
}

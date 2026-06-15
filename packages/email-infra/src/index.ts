export * from "./types";
export { InMemoryEmailInfra } from "./in-memory";
export { SmartleadEmailInfra } from "./smartlead";
export { OwnedEmailInfra } from "./owned/index";

import type { EmailInfra } from "./types";
import { SmartleadEmailInfra } from "./smartlead";
import { OwnedEmailInfra } from "./owned/index";
import { NameComRegistrar } from "./owned/registrar";
import { NameComDns } from "./owned/dns";
import { GoogleMailboxProvisioner } from "./owned/mailbox";
import { ApiWarmup } from "./owned/warmup";
import { GoogleGmailSender } from "./owned/gmail-send";
import { googleAccessToken } from "./owned/google-auth";

function requireEnv(name: string): string {
  const v = process.env[name];
  if (!v) throw new Error(`email infra env var missing: ${name}`);
  return v;
}

const chooseDomains = (accountId: string, count: number) =>
  Array.from({ length: count }, (_, i) => `${accountId.slice(0, 6)}-mail${i}.com`);
const localParts = (n: number) => Array.from({ length: n }, (_, i) => `sdr${i}`);

/** The only construction point product code may use (white-label, rule 03). */
export function createEmailInfraFromEnv(): EmailInfra {
  const provider = process.env.EMAIL_PROVIDER ?? "smartlead";
  if (provider === "owned") {
    const getAccessToken = () => googleAccessToken(requireEnv("GOOGLE_SERVICE_ACCOUNT_JSON"));
    const namecomUsername = requireEnv("NAMECOM_USERNAME");
    const namecomToken = requireEnv("NAMECOM_API_TOKEN");
    return new OwnedEmailInfra({
      registrar: new NameComRegistrar({ username: namecomUsername, token: namecomToken }),
      dns: new NameComDns({ username: namecomUsername, token: namecomToken }),
      mailbox: new GoogleMailboxProvisioner({ tenantLabel: requireEnv("GOOGLE_WORKSPACE_TENANT_LABEL"), getAccessToken }),
      warmup: new ApiWarmup({ apiKey: requireEnv("WARMUP_API_KEY") }),
      sender: new GoogleGmailSender({ getAccessToken }),
      webhookSecret: requireEnv("OWNED_EMAIL_WEBHOOK_SECRET"),
      chooseDomains,
      localParts,
    });
  }
  return new SmartleadEmailInfra({
    apiKey: requireEnv("SMARTLEAD_API_KEY"),
    webhookSecret: requireEnv("SMARTLEAD_WEBHOOK_SECRET"),
  });
}

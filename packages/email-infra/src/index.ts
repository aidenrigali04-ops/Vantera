export * from "./types";
export { InMemoryEmailInfra } from "./in-memory";
export { MaildosoEmailInfra } from "./maildoso/index";
export { MaildosoApiClient } from "./maildoso/api-client";
export { encryptSecret, decryptSecret } from "./maildoso/secret-crypto";

import type { EmailInfra, GetSmtpCreds } from "./types";
import { MaildosoEmailInfra } from "./maildoso/index";
import { MaildosoApiClient } from "./maildoso/api-client";
import { NodemailerTransport } from "./maildoso/nodemailer-transport";

/** The only construction point product code may use (white-label, rule 03).
 *  Pass `getSmtpCreds` from the jobs layer for the send path; omit it for provision-only callers. */
export function createEmailInfraFromEnv(opts?: { getSmtpCreds?: GetSmtpCreds }): EmailInfra {
  const apiKey = process.env.MAILDOSO_API_KEY;
  const webhookSecret = process.env.OWNED_EMAIL_WEBHOOK_SECRET;
  if (!apiKey || !webhookSecret) throw new Error("email infra env vars missing (MAILDOSO_API_KEY, OWNED_EMAIL_WEBHOOK_SECRET)");
  return new MaildosoEmailInfra({
    api: new MaildosoApiClient({ apiKey }),
    webhookSecret,
    transport: new NodemailerTransport(),
    getSmtpCreds: opts?.getSmtpCreds,
  });
}

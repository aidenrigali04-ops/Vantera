import type { EmailInfra } from "@vantera/email-infra";

export interface ProvisionEmailPayload {
  accountId: string;
  domainCount: number;
  mailboxesPerDomain: number;
  /** Brand source for branded sending domains (the account's company name + website). */
  companyName?: string | null;
  websiteUrl?: string | null;
}

export interface ProvisionEmailDeps {
  store: {
    saveProvisionedMailboxes(
      accountId: string,
      mailboxes: Awaited<ReturnType<EmailInfra["provision"]>>
    ): Promise<void>;
  };
  emailInfra: EmailInfra;
}

/** Provision domains + mailboxes via the provider, persist them (SMTP secret encrypted by the store). */
export async function runProvisionEmail(
  payload: ProvisionEmailPayload,
  deps: ProvisionEmailDeps
): Promise<{ created: number }> {
  const mailboxes = await deps.emailInfra.provision({
    accountId: payload.accountId,
    domainCount: payload.domainCount,
    mailboxesPerDomain: payload.mailboxesPerDomain,
    companyName: payload.companyName,
    websiteUrl: payload.websiteUrl,
  });
  await deps.store.saveProvisionedMailboxes(payload.accountId, mailboxes);
  return { created: mailboxes.length };
}

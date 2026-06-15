import type { EmailInfra } from "@vantera/email-infra";

export interface ProvisionEmailPayload {
  accountId: string;
  domainCount: number;
  mailboxesPerDomain: number;
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
  });
  await deps.store.saveProvisionedMailboxes(payload.accountId, mailboxes);
  return { created: mailboxes.length };
}

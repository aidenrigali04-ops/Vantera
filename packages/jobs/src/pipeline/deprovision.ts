import type { MaildosoApiClient } from "@vantera/email-infra";

export interface DeprovisionDeps {
  api: Pick<MaildosoApiClient, "deleteMailbox" | "releaseDomain">;
  store: {
    collectMailboxProviderRefs(accountId: string): Promise<{ providerRef: string; domain: string }[]>;
    purgeMailboxes(accountId: string): Promise<void>;
  };
}

/** Delete the account's mailboxes + release its domains at the provider, then purge local rows/secrets.
 *  No-op-safe: when the account has no mailboxes, no API calls are made. */
export async function runDeprovisionAccount(
  payload: { accountId: string },
  deps: DeprovisionDeps
): Promise<void> {
  const refs = await deps.store.collectMailboxProviderRefs(payload.accountId);
  for (const r of refs) {
    await deps.api.deleteMailbox(r.providerRef);
  }
  for (const domain of new Set(refs.map((r) => r.domain).filter(Boolean))) {
    await deps.api.releaseDomain(domain);
  }
  await deps.store.purgeMailboxes(payload.accountId);
}

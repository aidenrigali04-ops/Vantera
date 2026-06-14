import type { ProvisionEmailDeps, ProvisionEmailSummary } from "./types";

export async function runProvisionEmail(
  deps: ProvisionEmailDeps,
  req: { accountId: string; domainCount: number; mailboxesPerDomain: number },
): Promise<ProvisionEmailSummary> {
  const now = deps.now ?? (() => new Date());
  const mailboxes = await deps.emailInfra.provision(req);

  const domainIds = new Map<string, string>();
  for (const mb of mailboxes) {
    if (!domainIds.has(mb.domain)) {
      domainIds.set(mb.domain, await deps.store.upsertSendingDomain(req.accountId, mb.domain));
    }
    await deps.store.insertMailbox({
      accountId: req.accountId,
      domainId: domainIds.get(mb.domain)!,
      emailAddress: mb.address,
      providerRef: mb.id,
    });
  }
  for (const id of domainIds.values()) await deps.store.markDomainActive(id, now());

  return { status: "completed", domains: domainIds.size, mailboxes: mailboxes.length };
}

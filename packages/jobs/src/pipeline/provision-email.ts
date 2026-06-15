import type { ProvisionEmailDeps, ProvisionEmailSummary } from "./types";

/**
 * Safety backstop on registrar spend, independent of plan limits: the most NEW domains an
 * account can register in a rolling 24h. Stops a bug or retry loop from running up the
 * domain-registration bill. Plan entitlements still gate the user-facing request separately.
 */
export const MAX_DOMAINS_PER_ACCOUNT_PER_DAY = 20;

export async function runProvisionEmail(
  deps: ProvisionEmailDeps,
  req: { accountId: string; domainCount: number; mailboxesPerDomain: number },
): Promise<ProvisionEmailSummary> {
  const now = deps.now ?? (() => new Date());

  // Spend cap: refuse before buying if this batch would exceed the rolling-24h domain limit.
  const since = new Date(now().getTime() - 24 * 60 * 60 * 1000);
  const registeredToday = await deps.store.countDomainsCreatedSince(req.accountId, since);
  if (registeredToday + req.domainCount > MAX_DOMAINS_PER_ACCOUNT_PER_DAY) {
    throw new Error(
      `daily domain cap reached: ${registeredToday} registered in the last 24h + ${req.domainCount} requested exceeds ${MAX_DOMAINS_PER_ACCOUNT_PER_DAY}`,
    );
  }

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

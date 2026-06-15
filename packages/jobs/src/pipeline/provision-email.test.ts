import { describe, expect, it } from "vitest";
import { runProvisionEmail, MAX_DOMAINS_PER_ACCOUNT_PER_DAY } from "./provision-email";
import type { ProvisionEmailStore } from "./types";

function fakeStore(domainsToday = 0) {
  const domains = new Map<string, string>();
  const mailboxes: Array<{ emailAddress: string; domainId: string }> = [];
  const activated: string[] = [];
  const store: ProvisionEmailStore = {
    async upsertSendingDomain(_acct, domain) {
      if (!domains.has(domain)) domains.set(domain, `dom_${domains.size + 1}`);
      return domains.get(domain)!;
    },
    async markDomainActive(id) { activated.push(id); },
    async insertMailbox(m) { mailboxes.push({ emailAddress: m.emailAddress, domainId: m.domainId }); },
    async countDomainsCreatedSince() { return domainsToday; },
  };
  return { store, domains, mailboxes, activated };
}

describe("runProvisionEmail", () => {
  it("persists one domain row per distinct domain and one mailbox row per address", async () => {
    const { store, mailboxes, activated } = fakeStore();
    const emailInfra = {
      provision: async () => [
        { id: "sdr0@a.com", address: "sdr0@a.com", domain: "a.com" },
        { id: "sdr1@a.com", address: "sdr1@a.com", domain: "a.com" },
        { id: "sdr0@b.com", address: "sdr0@b.com", domain: "b.com" },
      ],
    };
    const summary = await runProvisionEmail(
      { store, emailInfra },
      { accountId: "acct1", domainCount: 2, mailboxesPerDomain: 2 },
    );
    expect(summary).toEqual({ status: "completed", domains: 2, mailboxes: 3 });
    expect(mailboxes).toHaveLength(3);
    expect(activated).toHaveLength(2);
  });

  it("throws (before buying anything) when the rolling-24h domain cap would be exceeded", async () => {
    const { store, mailboxes } = fakeStore(MAX_DOMAINS_PER_ACCOUNT_PER_DAY); // already at the cap
    let provisionCalled = false;
    const emailInfra = { provision: async () => { provisionCalled = true; return []; } };
    await expect(
      runProvisionEmail({ store, emailInfra }, { accountId: "acct1", domainCount: 1, mailboxesPerDomain: 1 }),
    ).rejects.toThrow(/daily domain cap/);
    expect(provisionCalled).toBe(false); // never reached the registrar — no spend
    expect(mailboxes).toHaveLength(0);
  });
});

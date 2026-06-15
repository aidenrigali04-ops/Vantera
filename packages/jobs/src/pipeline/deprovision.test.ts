import { describe, expect, it, vi } from "vitest";
import { runDeprovisionAccount } from "./deprovision";

describe("runDeprovisionAccount", () => {
  it("deletes each mailbox + releases each domain, then purges secrets", async () => {
    const api = { deleteMailbox: vi.fn(async () => {}), releaseDomain: vi.fn(async () => {}) };
    const store = {
      collectMailboxProviderRefs: vi.fn(async () => [{ providerRef: "mbx_1", domain: "d.com" }, { providerRef: "mbx_2", domain: "d.com" }]),
      purgeMailboxes: vi.fn(async () => {}),
    };
    await runDeprovisionAccount({ accountId: "acc_1" }, { api: api as any, store: store as any });
    expect(api.deleteMailbox).toHaveBeenCalledTimes(2);
    expect(api.releaseDomain).toHaveBeenCalledTimes(1); // unique domains
    expect(store.purgeMailboxes).toHaveBeenCalledWith("acc_1");
  });

  it("is a no-op (no api calls) when account has no mailboxes", async () => {
    const api = { deleteMailbox: vi.fn(async () => {}), releaseDomain: vi.fn(async () => {}) };
    const store = {
      collectMailboxProviderRefs: vi.fn(async () => []),
      purgeMailboxes: vi.fn(async () => {}),
    };
    await runDeprovisionAccount({ accountId: "acc_empty" }, { api: api as any, store: store as any });
    expect(api.deleteMailbox).not.toHaveBeenCalled();
    expect(api.releaseDomain).not.toHaveBeenCalled();
    expect(store.purgeMailboxes).toHaveBeenCalledWith("acc_empty");
  });

  it("releases each unique domain exactly once even with multiple mailboxes per domain", async () => {
    const api = { deleteMailbox: vi.fn(async () => {}), releaseDomain: vi.fn(async () => {}) };
    const store = {
      collectMailboxProviderRefs: vi.fn(async () => [
        { providerRef: "mbx_1", domain: "a.com" },
        { providerRef: "mbx_2", domain: "b.com" },
        { providerRef: "mbx_3", domain: "a.com" },
      ]),
      purgeMailboxes: vi.fn(async () => {}),
    };
    await runDeprovisionAccount({ accountId: "acc_1" }, { api: api as any, store: store as any });
    expect(api.deleteMailbox).toHaveBeenCalledTimes(3);
    expect(api.releaseDomain).toHaveBeenCalledTimes(2);
  });
});

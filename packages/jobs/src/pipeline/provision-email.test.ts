import { describe, expect, it, vi } from "vitest";
import { runProvisionEmail } from "./provision-email";
import { InMemoryEmailInfra } from "@vantera/email-infra";

describe("runProvisionEmail", () => {
  it("provisions and persists mailboxes for the account", async () => {
    const saved: any[] = [];
    const store = { saveProvisionedMailboxes: vi.fn(async (_a: string, m: any[]) => { saved.push(...m); }) };
    const out = await runProvisionEmail(
      { accountId: "acc_1", domainCount: 1, mailboxesPerDomain: 2 },
      { store: store as any, emailInfra: new InMemoryEmailInfra() }
    );
    expect(out.created).toBe(2);
    expect(store.saveProvisionedMailboxes).toHaveBeenCalledOnce();
    expect(saved[0].smtp.password).toBeTruthy();
  });
});

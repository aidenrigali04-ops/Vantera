import { describe, expect, it } from "vitest";
import { InMemoryMailboxProvisioner } from "./mailbox";

describe("InMemoryMailboxProvisioner", () => {
  it("adds+verifies a domain and creates users, returning addresses", async () => {
    const p = new InMemoryMailboxProvisioner();
    const dkim = await p.addAndVerifyDomain("acme.com");
    expect(dkim.dkimName).toBeTruthy();
    const created = await p.createUsers("acme.com", ["sdr0", "sdr1"]);
    expect(created).toEqual(["sdr0@acme.com", "sdr1@acme.com"]);
    expect(p.verifiedDomains).toContain("acme.com");
  });
});

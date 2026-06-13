import { describe, it, expect } from "vitest";
import { validateSenderAddress, validateProvisionCounts } from "./validation";

describe("validateSenderAddress", () => {
  it("requires line1, city, postal, country", () => {
    expect(validateSenderAddress({ line1: "", city: "Austin", postal: "78701", country: "USA" }).ok).toBe(false);
    expect(validateSenderAddress({ line1: "100 Main St", city: "Austin", postal: "78701", country: "USA" }).ok).toBe(true);
  });
  it("trims and carries optional line2/region", () => {
    const r = validateSenderAddress({ line1: " 100 Main St ", line2: "Suite 4", city: "Austin", region: "TX", postal: "78701", country: "USA" });
    expect(r.ok && r.values.line1).toBe("100 Main St");
    expect(r.ok && r.values.line2).toBe("Suite 4");
  });
});

describe("validateProvisionCounts", () => {
  it("clamps to 1-2 domains and 1-3 mailboxes per domain", () => {
    expect(validateProvisionCounts("0", "5")).toEqual({ domainCount: 1, mailboxesPerDomain: 3 });
    expect(validateProvisionCounts("2", "2")).toEqual({ domainCount: 2, mailboxesPerDomain: 2 });
    expect(validateProvisionCounts("junk", "junk")).toEqual({ domainCount: 1, mailboxesPerDomain: 1 });
  });
});

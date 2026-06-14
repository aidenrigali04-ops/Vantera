import { describe, it, expect } from "vitest";
import { canProvision, validateSenderAddress, validateProvisionCounts, validateProvisionInput } from "./validation";

describe("validateSenderAddress", () => {
  it("requires line1, city, postal, country", () => {
    expect(validateSenderAddress({ line1: "", city: "Austin", postal: "78701", country: "USA" }).ok).toBe(false);
    expect(validateSenderAddress({ line1: "100 Main St", city: "", postal: "78701", country: "USA" }).ok).toBe(false);
    expect(validateSenderAddress({ line1: "100 Main St", city: "Austin", postal: "", country: "USA" }).ok).toBe(false);
    expect(validateSenderAddress({ line1: "100 Main St", city: "Austin", postal: "78701", country: "" }).ok).toBe(false);
    expect(validateSenderAddress({ line1: "100 Main St", city: "Austin", postal: "78701", country: "USA" }).ok).toBe(true);
  });
  it("trims and carries optional line2/region", () => {
    const r = validateSenderAddress({ line1: " 100 Main St ", line2: "Suite 4", city: "Austin", region: "TX", postal: "78701", country: "USA" });
    expect(r.ok && r.values.line1).toBe("100 Main St");
    expect(r.ok && r.values.line2).toBe("Suite 4");
  });
});

describe("canProvision (the rule-11 + re-provisioning gate)", () => {
  it("refuses without a saved sender address — rule 11", () => {
    const gate = canProvision(null, 0);
    expect(gate.ok).toBe(false);
    expect(!gate.ok && gate.error).toMatch(/sender address/i);
  });
  it("refuses re-provisioning once mailboxes exist", () => {
    const gate = canProvision({ line1: "100 Main St" }, 2);
    expect(gate.ok).toBe(false);
    expect(!gate.ok && gate.error).toMatch(/already set up/i);
  });
  it("allows first provisioning with an address on file", () => {
    expect(canProvision({ line1: "100 Main St" }, 0).ok).toBe(true);
  });
});

describe("validateProvisionInput", () => {
  it("accepts in-range counts", () => {
    expect(validateProvisionInput({ domainCount: 2, mailboxesPerDomain: 2 })).toEqual({ ok: true });
  });
  it("rejects zero or excessive counts", () => {
    expect(validateProvisionInput({ domainCount: 0, mailboxesPerDomain: 2 }).ok).toBe(false);
    expect(validateProvisionInput({ domainCount: 1, mailboxesPerDomain: 99 }).ok).toBe(false);
  });
});

describe("validateProvisionCounts", () => {
  it("clamps to 1-2 domains and 1-3 mailboxes per domain", () => {
    expect(validateProvisionCounts("0", "5")).toEqual({ domainCount: 1, mailboxesPerDomain: 3 });
    expect(validateProvisionCounts("2", "2")).toEqual({ domainCount: 2, mailboxesPerDomain: 2 });
    expect(validateProvisionCounts("junk", "junk")).toEqual({ domainCount: 1, mailboxesPerDomain: 1 });
  });
});

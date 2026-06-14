import { describe, expect, it, vi } from "vitest";
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

import { GoogleMailboxProvisioner } from "./mailbox";

describe("GoogleMailboxProvisioner", () => {
  it("creates users for each local-part via the Directory API and returns addresses", async () => {
    const bodies: string[] = [];
    const fetchFn = vi.fn(async (_url: string, init?: RequestInit) => {
      if (init?.body) bodies.push(init.body as string);
      return { ok: true, status: 200, json: async () => ({ primaryEmail: "x" }), text: async () => "" };
    }) as unknown as typeof fetch;
    const p = new GoogleMailboxProvisioner({ tenantLabel: "t1", getAccessToken: async () => "tok", fetchFn });
    const created = await p.createUsers("acme.com", ["sdr0", "sdr1"]);
    expect(created).toEqual(["sdr0@acme.com", "sdr1@acme.com"]);
    expect(bodies.some((b) => b.includes("sdr0@acme.com"))).toBe(true);
  });
});

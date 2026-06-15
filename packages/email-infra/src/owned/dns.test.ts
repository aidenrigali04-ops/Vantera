import { describe, expect, it, vi } from "vitest";
import { InMemoryDns } from "./dns";

describe("InMemoryDns", () => {
  it("writes the email auth record set for a domain", async () => {
    const dns = new InMemoryDns();
    await dns.writeEmailRecords("acme.com", { dkimName: "google._domainkey", dkimValue: "v=DKIM1; k=rsa; p=AAAA" });
    const records = dns.recordsFor("acme.com");
    expect(records.find((r) => r.type === "MX")?.value).toContain("aspmx.l.google.com");
    expect(records.some((r) => r.type === "TXT" && r.value.includes("v=spf1") && r.value.includes("_spf.google.com"))).toBe(true);
    expect(records.some((r) => r.type === "TXT" && r.name.startsWith("_dmarc"))).toBe(true);
    expect(records.some((r) => r.type === "TXT" && r.name === "google._domainkey")).toBe(true);
  });
});

import { NameComDns, buildEmailRecords, toHost } from "./dns";

describe("NameComDns", () => {
  it("POSTs one record per built record to /v4/domains/{domain}/records with apex-relative hosts", async () => {
    const calls: string[] = [];
    const bodies: string[] = [];
    const fetchFn = vi.fn(async (url: string, init?: RequestInit) => {
      calls.push(url);
      if (init?.body) bodies.push(init.body as string);
      return { ok: true, status: 200, json: async () => ({}), text: async () => "" };
    }) as unknown as typeof fetch;
    const dns = new NameComDns({ username: "u", token: "t", fetchFn });
    await dns.writeEmailRecords("acme.com", { dkimName: "google._domainkey.acme.com", dkimValue: "v=DKIM1;p=K" });

    const expected = buildEmailRecords("acme.com", { dkimName: "google._domainkey.acme.com", dkimValue: "v=DKIM1;p=K" }).length;
    expect(calls.filter((u) => u.includes("/v4/domains/acme.com/records")).length).toBe(expected);
    const parsed = bodies.map((b) => JSON.parse(b) as { host: string; type: string; priority?: number });
    expect(parsed.some((r) => r.host === "" && r.type === "MX" && r.priority === 1)).toBe(true);
    expect(parsed.some((r) => r.host === "_dmarc")).toBe(true);
    expect(parsed.some((r) => r.host === "google._domainkey")).toBe(true);
  });
});

describe("toHost", () => {
  it("converts an FQDN record name to an apex-relative host", () => {
    expect(toHost("acme.com", "acme.com")).toBe("");
    expect(toHost("_dmarc.acme.com", "acme.com")).toBe("_dmarc");
    expect(toHost("google._domainkey.acme.com", "acme.com")).toBe("google._domainkey");
  });
});

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

import { CloudflareDns, buildEmailRecords } from "./dns";

describe("CloudflareDns", () => {
  it("POSTs one DNS record per built record into the domain's zone", async () => {
    const calls: string[] = [];
    const fetchFn = vi.fn(async (url: string) => { calls.push(url); return { ok: true, status: 200, json: async () => ({ result: { id: "z1" } }), text: async () => "" }; }) as unknown as typeof fetch;
    const dns = new CloudflareDns({ apiToken: "t", fetchFn });
    await dns.writeEmailRecords("acme.com", { dkimName: "google._domainkey.acme.com", dkimValue: "v=DKIM1;p=K" });
    const expected = buildEmailRecords("acme.com", { dkimName: "google._domainkey.acme.com", dkimValue: "v=DKIM1;p=K" }).length;
    const recordPosts = calls.filter((u) => u.includes("/dns_records"));
    expect(recordPosts.length).toBe(expected);
  });
});

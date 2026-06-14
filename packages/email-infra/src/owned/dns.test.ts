import { describe, expect, it } from "vitest";
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

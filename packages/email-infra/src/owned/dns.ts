export interface DnsRecord { type: "MX" | "TXT" | "CNAME"; name: string; value: string; priority?: number }
export interface DkimRecord { dkimName: string; dkimValue: string }

/** Writes the Google-Workspace email auth record set for a domain. */
export interface DnsManager {
  writeEmailRecords(domain: string, dkim: DkimRecord): Promise<void>;
}

/** Shared record builder so the fake and the real adapter stay identical. */
export function buildEmailRecords(domain: string, dkim: DkimRecord): DnsRecord[] {
  return [
    { type: "MX", name: domain, value: "aspmx.l.google.com", priority: 1 },
    { type: "MX", name: domain, value: "alt1.aspmx.l.google.com", priority: 5 },
    { type: "TXT", name: domain, value: "v=spf1 include:_spf.google.com ~all" },
    { type: "TXT", name: dkim.dkimName, value: dkim.dkimValue },
    { type: "TXT", name: `_dmarc.${domain}`, value: "v=DMARC1; p=quarantine; rua=mailto:dmarc@" + domain },
  ];
}

export class InMemoryDns implements DnsManager {
  private readonly records = new Map<string, DnsRecord[]>();
  async writeEmailRecords(domain: string, dkim: DkimRecord): Promise<void> {
    this.records.set(domain, buildEmailRecords(domain, dkim));
  }
  recordsFor(domain: string): DnsRecord[] {
    return this.records.get(domain) ?? [];
  }
}

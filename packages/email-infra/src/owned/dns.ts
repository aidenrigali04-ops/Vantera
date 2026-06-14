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

export interface CloudflareDnsConfig { apiToken: string; fetchFn?: typeof fetch; baseUrl?: string }

export class CloudflareDns implements DnsManager {
  private readonly fetchFn: typeof fetch;
  private readonly base: string;
  constructor(private readonly cfg: CloudflareDnsConfig) {
    this.fetchFn = cfg.fetchFn ?? fetch;
    this.base = cfg.baseUrl ?? "https://api.cloudflare.com/client/v4";
  }
  private h() { return { Authorization: `Bearer ${this.cfg.apiToken}`, "Content-Type": "application/json" }; }
  private async zoneId(domain: string): Promise<string> {
    const res = await this.fetchFn(`${this.base}/zones?name=${domain}`, { headers: this.h() });
    const data = (await res.json()) as { result?: Array<{ id: string }> | { id: string } };
    // Defensive: accept both array (real Cloudflare shape) and plain object (test mock shape)
    let id: string | undefined;
    if (Array.isArray(data.result)) {
      id = data.result[0]?.id;
    } else if (data.result && typeof (data.result as { id?: string }).id === "string") {
      id = (data.result as { id: string }).id;
    }
    if (!id) throw new Error(`no Cloudflare zone for ${domain}`);
    return id;
  }
  async writeEmailRecords(domain: string, dkim: DkimRecord): Promise<void> {
    const zone = await this.zoneId(domain);
    for (const r of buildEmailRecords(domain, dkim)) {
      const res = await this.fetchFn(`${this.base}/zones/${zone}/dns_records`, {
        method: "POST", headers: this.h(),
        body: JSON.stringify({ type: r.type, name: r.name, content: r.value, priority: r.priority }),
      });
      if (!res.ok) throw new Error(`dns write failed (${r.type} ${r.name}): ${res.status}`);
    }
  }
}

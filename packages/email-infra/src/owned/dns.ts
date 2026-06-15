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

export interface NameComDnsConfig { username: string; token: string; fetchFn?: typeof fetch; baseUrl?: string }

/** Convert an FQDN record name to a Name.com host (relative to the domain apex; "" = apex). */
export function toHost(name: string, domain: string): string {
  if (name === domain) return "";
  return name.endsWith(`.${domain}`) ? name.slice(0, -(domain.length + 1)) : name;
}

/**
 * Name.com Core API v4 DNS. Same provider as the registrar, so domains register and get
 * their email auth records written in one account — no cross-provider nameserver dance.
 * Records POST to /v4/domains/{domain}/records with a host relative to the apex.
 */
export class NameComDns implements DnsManager {
  private readonly fetchFn: typeof fetch;
  private readonly base: string;
  constructor(private readonly cfg: NameComDnsConfig) {
    this.fetchFn = cfg.fetchFn ?? fetch;
    this.base = cfg.baseUrl ?? "https://api.name.com";
  }
  private h() {
    const basic = Buffer.from(`${this.cfg.username}:${this.cfg.token}`).toString("base64");
    return { Authorization: `Basic ${basic}`, "Content-Type": "application/json" };
  }
  async writeEmailRecords(domain: string, dkim: DkimRecord): Promise<void> {
    for (const r of buildEmailRecords(domain, dkim)) {
      const res = await this.fetchFn(`${this.base}/v4/domains/${domain}/records`, {
        method: "POST", headers: this.h(),
        body: JSON.stringify({
          host: toHost(r.name, domain),
          type: r.type,
          answer: r.value,
          ttl: 300,
          ...(r.priority != null ? { priority: r.priority } : {}),
        }),
      });
      if (!res.ok) throw new Error(`dns write failed (${r.type} ${r.name}): ${res.status}`);
    }
  }
}

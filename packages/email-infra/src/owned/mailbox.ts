import { randomUUID } from "node:crypto";
import type { DkimRecord } from "./dns";

/** Creates + verifies a domain on a Workspace tenant and provisions users. */
export interface MailboxProvisioner {
  /** add domain to a tenant, publish/verify, return its DKIM record for DNS */
  addAndVerifyDomain(domain: string): Promise<DkimRecord>;
  /** create users (local-parts) on a verified domain; returns full addresses */
  createUsers(domain: string, localParts: string[]): Promise<string[]>;
}

export class InMemoryMailboxProvisioner implements MailboxProvisioner {
  readonly verifiedDomains: string[] = [];
  async addAndVerifyDomain(domain: string): Promise<DkimRecord> {
    this.verifiedDomains.push(domain);
    return { dkimName: `google._domainkey.${domain}`, dkimValue: "v=DKIM1; k=rsa; p=TESTKEY" };
  }
  async createUsers(domain: string, localParts: string[]): Promise<string[]> {
    return localParts.map((lp) => `${lp}@${domain}`);
  }
}

export interface GoogleMailboxConfig {
  tenantLabel: string;
  getAccessToken: () => Promise<string>;
  fetchFn?: typeof fetch;
  baseUrl?: string;
  passwordFn?: () => string;
}

export class GoogleMailboxProvisioner implements MailboxProvisioner {
  private readonly fetchFn: typeof fetch;
  private readonly base: string;
  constructor(private readonly cfg: GoogleMailboxConfig) {
    this.fetchFn = cfg.fetchFn ?? fetch;
    this.base = cfg.baseUrl ?? "https://admin.googleapis.com/admin/directory/v1";
  }
  private async h() { return { Authorization: `Bearer ${await this.cfg.getAccessToken()}`, "Content-Type": "application/json" }; }

  async addAndVerifyDomain(domain: string): Promise<DkimRecord> {
    const headers = await this.h();
    const add = await this.fetchFn(`${this.base}/customer/my_customer/domains`, {
      method: "POST", headers, body: JSON.stringify({ domainName: domain }),
    });
    if (!add.ok && add.status !== 409) throw new Error(`domain add failed ${domain}: ${add.status}`);
    // TODO(verify-live): Google DKIM generation is not a simple documented REST call on this endpoint —
    // confirm the real mechanism (Email Settings/Gmail postmaster) before production.
    const dkim = await this.fetchFn(`${this.base}/customer/my_customer/domains/${domain}/dkim`, { headers });
    const data = dkim.ok ? ((await dkim.json()) as { name?: string; publicKey?: string }) : {};
    return {
      dkimName: data.name ?? `google._domainkey.${domain}`,
      dkimValue: data.publicKey ?? "",
    };
  }

  async createUsers(domain: string, localParts: string[]): Promise<string[]> {
    const headers = await this.h();
    const out: string[] = [];
    for (const lp of localParts) {
      const primaryEmail = `${lp}@${domain}`;
      const res = await this.fetchFn(`${this.base}/users`, {
        method: "POST", headers,
        body: JSON.stringify({
          primaryEmail,
          name: { givenName: lp, familyName: "Sender" },
          password: (this.cfg.passwordFn ?? randomUUID)(),
        }),
      });
      if (!res.ok && res.status !== 409) throw new Error(`user create failed ${primaryEmail}: ${res.status}`);
      out.push(primaryEmail);
    }
    return out;
  }
}

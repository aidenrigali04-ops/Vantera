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

import { describe, expect, it, vi } from "vitest";
import { MaildosoEmailInfra } from "./index";
import type { SmtpCredentials, SmtpTransport } from "./smtp-sender";
import type { MaildosoApiClient } from "./api-client";

const creds: SmtpCredentials = { host: "h", port: 587, username: "sdr0@d.com", password: "p" };

function fakeApi(): MaildosoApiClient {
  return {
    ensureDomain: vi.fn(async () => {}),
    createMailbox: vi.fn(async (domain: string, lp: string) => ({
      providerRef: `mbx_${lp}`, address: `${lp}@${domain}`, domain, smtp: creds,
    })),
    getWarmup: vi.fn(async () => ({ phase: "warming" as const, dailyCap: 12 })),
    deleteMailbox: vi.fn(async () => {}),
    releaseDomain: vi.fn(async () => {}),
  } as unknown as MaildosoApiClient;
}

describe("MaildosoEmailInfra", () => {
  it("provision creates N mailboxes per domain with smtp creds", async () => {
    const infra = new MaildosoEmailInfra({ api: fakeApi(), webhookSecret: "whsec" });
    const out = await infra.provision({ accountId: "acc_1", domainCount: 1, mailboxesPerDomain: 2 });
    expect(out).toHaveLength(2);
    expect(out[0]!.smtp).toEqual(creds);
    // id is the Maildoso provider ref (persisted as mailboxes.provider_ref), NOT the address
    expect(out[0]!.id).toBe("mbx_sdr0");
    expect(out[0]!.id).not.toBe(out[0]!.address);
  });

  it("provisions on branded look-alike domains from the account brand, never the primary", async () => {
    const api = fakeApi();
    const infra = new MaildosoEmailInfra({ api, webhookSecret: "whsec" });
    const out = await infra.provision({
      accountId: "acc_1",
      domainCount: 1,
      mailboxesPerDomain: 1,
      companyName: "Acme Inc",
      websiteUrl: "https://www.acme.com",
    });
    const domain = out[0]!.domain;
    expect(domain).toContain("acme"); // recognizable as the customer
    expect(domain).not.toBe("acme.com"); // never their real corporate domain
    expect(domain).not.toContain("maildoso.app"); // branded, not the neutral fallback
  });

  it("skips a taken branded candidate and registers the next available one", async () => {
    const api = fakeApi();
    // first branded candidate is taken (ensureDomain throws once), then succeeds
    let calls = 0;
    (api.ensureDomain as any).mockImplementation(async () => {
      calls += 1;
      if (calls === 1) throw new Error("domain taken");
    });
    const infra = new MaildosoEmailInfra({ api, webhookSecret: "whsec" });
    const out = await infra.provision({
      accountId: "acc_1", domainCount: 1, mailboxesPerDomain: 1,
      companyName: "Acme", websiteUrl: "https://acme.com",
    });
    expect(calls).toBeGreaterThanOrEqual(2); // tried again after the taken one
    expect(out[0]!.domain).toContain("acme");
  });

  it("falls back to a neutral provider subdomain when no brand is known", async () => {
    const infra = new MaildosoEmailInfra({ api: fakeApi(), webhookSecret: "whsec" });
    const out = await infra.provision({ accountId: "acc_1", domainCount: 1, mailboxesPerDomain: 1 });
    expect(out[0]!.domain).toContain("maildoso.app");
  });

  it("send resolves creds via getSmtpCreds and sets List-Unsubscribe", async () => {
    const transport: SmtpTransport = { sendMail: vi.fn(async () => ({ messageId: "smtp_1" })) };
    const infra = new MaildosoEmailInfra({
      api: fakeApi(), webhookSecret: "whsec", transport,
      getSmtpCreds: async () => creds,
    });
    const res = await infra.send({
      mailboxId: "mbx_x", to: "lead@x.com", subject: "Hi", body: "<p>hi</p>",
      campaignId: "c1", leadId: "l1", unsubscribeUrl: "https://app/u/abc",
    });
    expect(res.messageId).toBe("smtp_1");
    const arg = (transport.sendMail as any).mock.calls[0][1];
    expect(arg.headers["List-Unsubscribe"]).toContain("https://app/u/abc");
  });

  it("send throws if getSmtpCreds was not wired", async () => {
    const infra = new MaildosoEmailInfra({ api: fakeApi(), webhookSecret: "whsec" });
    await expect(infra.send({ mailboxId: "m", to: "a@b.com", subject: "s", body: "b", campaignId: "c", leadId: "l" }))
      .rejects.toThrow(/getSmtpCreds/);
  });

  it("verifyWebhook is timing-safe and rejects a wrong secret", () => {
    const infra = new MaildosoEmailInfra({ api: fakeApi(), webhookSecret: "whsec" });
    expect(infra.verifyWebhook({ "x-maildoso-secret": "whsec" }, "{}")).toBe(true);
    expect(infra.verifyWebhook({ "x-maildoso-secret": "wrong" }, "{}")).toBe(false);
  });
});

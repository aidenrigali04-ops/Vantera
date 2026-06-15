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

import { createHmac } from "node:crypto";
import { describe, expect, it } from "vitest";
import { MetaAdsInfra } from "./meta";

const infra = new MetaAdsInfra({ accessToken: "t", adAccountId: "act_1", appSecret: "shh" });

function sign(body: string): string {
  return `sha256=${createHmac("sha256", "shh").update(body).digest("hex")}`;
}

describe("MetaAdsInfra.verifyWebhook", () => {
  it("accepts a correctly signed body and rejects tampering", () => {
    const body = '{"x":1}';
    expect(infra.verifyWebhook({ "x-hub-signature-256": sign(body) }, body)).toBe(true);
    expect(infra.verifyWebhook({ "x-hub-signature-256": sign(body) }, '{"x":2}')).toBe(false);
    expect(infra.verifyWebhook({}, body)).toBe(false);
  });
});

describe("MetaAdsInfra.parseLeadWebhook", () => {
  it("extracts contact fields from a leadgen change", () => {
    const payload = {
      entry: [
        {
          changes: [
            {
              value: {
                leadgen_id: "L1",
                form_id: "F1",
                ad_id: "AD9",
                created_time: "2026-06-16T00:00:00Z",
                field_data: [
                  { name: "email", values: ["jordan@acme.com"] },
                  { name: "full_name", values: ["Jordan Lee"] },
                  { name: "company_name", values: ["Acme"] },
                ],
              },
            },
          ],
        },
      ],
    };
    expect(infra.parseLeadWebhook(payload)).toEqual({
      providerLeadId: "L1",
      providerFormId: "F1",
      campaignRef: "AD9",
      fields: { email: "jordan@acme.com", firstName: null, fullName: "Jordan Lee", companyName: "Acme" },
      createdAt: "2026-06-16T00:00:00Z",
    });
  });

  it("returns null when there's no lead id", () => {
    expect(infra.parseLeadWebhook({ entry: [{ changes: [{ value: {} }] }] })).toBeNull();
    expect(infra.parseLeadWebhook(null)).toBeNull();
  });

  it("publishAd is not enabled yet (operational remainder)", async () => {
    await expect(
      infra.publishAd({
        campaignName: "c",
        dailyBudgetCents: 1000,
        audience: "x",
        concept: { headline: "h", primaryText: "p", cta: "SIGN_UP", creativeUrl: null },
        leadFormId: null,
        campaignRef: "r",
      })
    ).rejects.toThrow();
  });
});

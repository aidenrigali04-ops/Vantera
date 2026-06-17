import type { AdLeadEvent, AdsInfra, LeadFormRequest, PublishAdRequest, PublishedAd } from "./types";

/** In-memory AdsInfra for tests/dev — records calls, returns deterministic ids, no network. */
export class InMemoryAdsInfra implements AdsInfra {
  readonly published: PublishAdRequest[] = [];
  readonly forms: LeadFormRequest[] = [];
  /** the secret the fake checks verifyWebhook against (plain equality; real adapter is timing-safe) */
  constructor(private readonly webhookSecret = "test-ads-secret") {}

  async publishAd(req: PublishAdRequest): Promise<PublishedAd> {
    this.published.push(req);
    const n = this.published.length;
    return { providerCampaignId: `camp_${n}`, providerAdId: `ad_${n}`, status: "in_review" };
  }

  async createLeadForm(req: LeadFormRequest): Promise<{ formId: string }> {
    this.forms.push(req);
    return { formId: `form_${this.forms.length}` };
  }

  verifyWebhook(headers: Record<string, string>): boolean {
    return headers["x-ads-signature"] === this.webhookSecret;
  }

  parseLeadWebhook(payload: unknown): AdLeadEvent | null {
    const p = payload as Partial<AdLeadEvent> | null;
    if (!p || typeof p.providerLeadId !== "string") return null;
    return {
      providerLeadId: p.providerLeadId,
      providerFormId: typeof p.providerFormId === "string" ? p.providerFormId : "",
      campaignRef: typeof p.campaignRef === "string" ? p.campaignRef : null,
      fields: p.fields ?? {},
      createdAt: typeof p.createdAt === "string" ? p.createdAt : new Date().toISOString(),
    };
  }
}

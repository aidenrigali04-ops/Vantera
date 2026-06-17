import { createHmac, timingSafeEqual } from "node:crypto";
import type { AdLeadEvent, AdsInfra, LeadFormRequest, PublishAdRequest, PublishedAd } from "./types";

/**
 * Meta (Facebook/Instagram) Marketing API adapter. The vendor name stays inside this file
 * (white-label, rules 02/13). Webhook verification + lead-event parsing are implemented; the
 * publish flow (campaign → ad set → creative → ad) is the operational remainder — it needs a live
 * access token + ad-account id and is wired in once those env vars exist (see .env.example).
 */
export interface MetaAdsConfig {
  accessToken: string;
  adAccountId: string;
  /** app secret used to verify the X-Hub-Signature-256 header on lead webhooks */
  appSecret: string;
}

class AdsNotConfiguredError extends Error {
  readonly code = "ADS_NOT_CONFIGURED";
}

export class MetaAdsInfra implements AdsInfra {
  constructor(private readonly config: MetaAdsConfig) {}

  async publishAd(_req: PublishAdRequest): Promise<PublishedAd> {
    // Operational remainder: campaign → ad set → creative → ad via the Graph API.
    throw new AdsNotConfiguredError("ad publishing is not enabled yet");
  }

  async createLeadForm(_req: LeadFormRequest): Promise<{ formId: string }> {
    throw new AdsNotConfiguredError("lead forms are not enabled yet");
  }

  /** Meta signs lead webhooks with the app secret: `X-Hub-Signature-256: sha256=<hex>`. */
  verifyWebhook(headers: Record<string, string>, rawBody: string): boolean {
    const header = headers["x-hub-signature-256"];
    if (!header || !header.startsWith("sha256=")) return false;
    const provided = header.slice("sha256=".length);
    const expected = createHmac("sha256", this.config.appSecret).update(rawBody).digest("hex");
    if (provided.length !== expected.length) return false;
    try {
      return timingSafeEqual(Buffer.from(provided, "hex"), Buffer.from(expected, "hex"));
    } catch {
      return false;
    }
  }

  /** Parse a leadgen webhook change into our neutral AdLeadEvent (best-effort across shapes). */
  parseLeadWebhook(payload: unknown): AdLeadEvent | null {
    const p = payload as Record<string, unknown> | null;
    const change = (p?.entry as { changes?: { value?: Record<string, unknown> }[] }[] | undefined)?.[0]
      ?.changes?.[0]?.value;
    const value = (change ?? p) as Record<string, unknown> | undefined;
    if (!value) return null;
    const leadId = value.leadgen_id ?? value.lead_id ?? value.providerLeadId;
    if (typeof leadId !== "string") return null;
    const raw = (value.field_data ?? value.fields ?? []) as { name?: string; values?: string[] }[];
    const byName = (key: string): string | null => {
      const f = raw.find((x) => x.name?.toLowerCase().includes(key));
      return f?.values?.[0] ?? null;
    };
    return {
      providerLeadId: leadId,
      providerFormId: typeof value.form_id === "string" ? value.form_id : "",
      campaignRef:
        typeof value.campaign_ref === "string"
          ? value.campaign_ref
          : typeof value.ad_id === "string"
            ? value.ad_id
            : null,
      fields: {
        email: byName("email"),
        firstName: byName("first_name") ?? byName("first name"),
        fullName: byName("full_name") ?? byName("full name") ?? byName("name"),
        companyName: byName("company"),
      },
      createdAt: typeof value.created_time === "string" ? value.created_time : new Date().toISOString(),
    };
  }
}

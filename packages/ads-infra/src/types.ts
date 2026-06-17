// Provider-agnostic ad-platform interface (Phase 11, rules 02/13). The Meta Marketing API is an
// implementation detail behind it — the vendor name never leaves this package (white-label). Ad
// concepts come from the ad brain; budget/targeting/scheduling decisions live in the pipeline.

/** One ad concept ready to publish (copy + the resolved creative asset). */
export interface AdConceptPayload {
  headline: string;
  primaryText: string;
  description?: string;
  /** the platform CTA button id (e.g. SIGN_UP, LEARN_MORE) */
  cta: string;
  /** URL of the generated creative asset (image/video); null = publish copy-only / placeholder */
  creativeUrl: string | null;
}

export interface PublishAdRequest {
  campaignName: string;
  dailyBudgetCents: number;
  /** human-readable audience description (resolved to a provider audience spec in the adapter) */
  audience: string;
  concept: AdConceptPayload;
  /** instant lead-form id this ad collects through; null = a click/traffic ad */
  leadFormId: string | null;
  /** rides through the provider as metadata so the lead webhook attributes back to our row */
  campaignRef: string;
}

export interface PublishedAd {
  providerCampaignId: string;
  providerAdId: string;
  status: "active" | "in_review" | "paused";
}

export interface LeadFormRequest {
  name: string;
  /** questions the instant form asks (email is always collected) */
  questions: string[];
  campaignRef: string;
}

/** A lead submitted through an instant lead-gen form, delivered by the provider's webhook. */
export interface AdLeadEvent {
  providerLeadId: string;
  providerFormId: string;
  campaignRef: string | null;
  fields: {
    email?: string | null;
    firstName?: string | null;
    fullName?: string | null;
    companyName?: string | null;
  };
  createdAt: string;
}

export interface AdsInfra {
  publishAd(req: PublishAdRequest): Promise<PublishedAd>;
  createLeadForm(req: LeadFormRequest): Promise<{ formId: string }>;
  /**
   * Reject forged payloads BEFORE parsing. Real adapters must use a timing-safe comparison
   * (crypto.timingSafeEqual); the in-memory fake uses plain equality.
   */
  verifyWebhook(headers: Record<string, string>, rawBody: string): boolean;
  parseLeadWebhook(payload: unknown): AdLeadEvent | null;
}

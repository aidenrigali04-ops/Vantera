export type {
  AdsInfra,
  AdConceptPayload,
  PublishAdRequest,
  PublishedAd,
  LeadFormRequest,
  AdLeadEvent,
} from "./types";
export { InMemoryAdsInfra } from "./in-memory";
export { MetaAdsInfra, type MetaAdsConfig } from "./meta";

import { MetaAdsInfra } from "./meta";
import type { AdsInfra } from "./types";

/** Build the real ad-platform adapter from env; throws if the integration isn't configured. */
export function createAdsInfraFromEnv(): AdsInfra {
  const accessToken = process.env.ADS_ACCESS_TOKEN;
  const adAccountId = process.env.ADS_AD_ACCOUNT_ID;
  const appSecret = process.env.ADS_APP_SECRET;
  if (!accessToken || !adAccountId || !appSecret) {
    throw new Error("ads infra not configured (ADS_ACCESS_TOKEN / ADS_AD_ACCOUNT_ID / ADS_APP_SECRET)");
  }
  return new MetaAdsInfra({ accessToken, adAccountId, appSecret });
}

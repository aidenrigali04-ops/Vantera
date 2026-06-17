import { logger, task } from "@trigger.dev/sdk";
import { createDb } from "@vantera/db";
import { runAdInbound } from "../pipeline/ads-inbound";
import { createAdInboundStore } from "../pipeline/pg-store";
import type { AdInboundEvent } from "../pipeline/types";

/**
 * Ad-lead ingestion (Phase 11). Enqueued by the verified ads webhook when an ad lead-form is
 * submitted. The core records the lead (source 'ad') and enrols it into the existing nurture
 * engine. This wrapper only wires real deps + logs (rule 13).
 */
export const adsInbound = task({
  id: "ads-inbound",
  maxDuration: 300,
  run: async (event: AdInboundEvent) => {
    const summary = await runAdInbound(event, { store: createAdInboundStore(createDb()) });
    logger.info("ad lead ingested", { campaignRef: event.campaignRef, ...summary });
    return summary;
  },
});

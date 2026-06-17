import { logger, task } from "@trigger.dev/sdk";
import { createDb } from "@vantera/db";
import { draftEmail, rankLeads } from "@vantera/agent-brains";
import type { LeadInsights, RankCandidate, RankContext } from "@vantera/agent-brains";
import { processInboundLead } from "../pipeline/inbound-respond";
import { createInboundRespondStore } from "../pipeline/pg-store";
import { SCOUT_DEFAULTS } from "../pipeline/types";
import type { InboundLeadEvent } from "../pipeline/types";

/**
 * Inbound Responder pipeline (Phase 12). Enqueued by the intake webhook the moment a lead
 * arrives — speed is the product. The core (processInboundLead) qualifies through the SAME
 * AI rank gate (rule 06) so fast never means spray, drafts with the SAME copy brain, and
 * either auto-sends a clean reply within SLA or routes it to review. This wrapper only wires
 * real deps + logs (rule 13).
 */
export const inboundRespond = task({
  id: "inbound-respond",
  maxDuration: 600,
  run: async (event: InboundLeadEvent) => {
    const store = createInboundRespondStore(createDb());
    const summary = await processInboundLead(event, {
      store,
      // Qualify the inbound contact through the AI rank gate. Inbound leads carry only what the
      // source submitted (email/name/company) — we rank fit against the seller's ICP context and
      // keep the locked min-score bar (rule 06); a low score is rejected, never auto-answered.
      qualify: async (lead) => {
        const ctx = await store.getResponderContext(lead.agentId);
        const rankCtx: RankContext = {
          accountIndustry: ctx?.accountIndustry ?? null,
          valueProp: ctx?.valueProp ?? null,
          icpDescription: ctx?.cta ?? null,
        };
        const candidate: RankCandidate = {
          leadId: "inbound",
          companyName: lead.companyName ?? undefined,
        };
        const ranked = await rankLeads([candidate], rankCtx);
        const insights: LeadInsights = ranked[0] ?? {
          lead_id: "inbound",
          reasoning: "no rank produced",
          score: 0,
          rationale: "could not assess fit",
          pain_points: [],
          triggers: [],
          motivations: [],
          value_angle: "",
          aha_moment: "",
          summary: "",
        };
        return { passed: insights.score >= SCOUT_DEFAULTS.minScore, insights };
      },
      draftEmailFn: (input) => draftEmail(input),
    });
    logger.info("inbound responded", { agentId: event.agentId, ...summary });
    return summary;
  },
});

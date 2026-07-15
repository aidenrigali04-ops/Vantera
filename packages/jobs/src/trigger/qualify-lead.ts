import { logger, task } from "@trigger.dev/sdk";
import { createDb } from "@vantera/db";
import { rankLeads } from "@vantera/agent-brains";
import { runQualifyLead } from "../pipeline/qualify-lead";
import { createPgStore } from "../pipeline/pg-store";

/**
 * R6: qualify ONE manually-added lead through the same rules gate + AI rank as discovery
 * (rule 06 — manual entry is an origin label, never a bypass). Triggered by the web app's
 * Add-lead action right after the insert.
 */
export const qualifyLead = task({
  id: "qualify-lead",
  queue: { concurrencyLimit: 1 },
  maxDuration: 300,
  run: async (payload: { accountId: string; leadId: string }) => {
    const store = createPgStore(createDb());
    const outcome = await runQualifyLead(payload.accountId, payload.leadId, {
      store,
      rankFn: (candidates, ctx) => rankLeads(candidates, ctx),
    });
    logger.info("qualify-lead finished", { ...payload, outcome });
    return { outcome };
  },
});

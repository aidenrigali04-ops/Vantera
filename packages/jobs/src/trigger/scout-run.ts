import { logger, task, tasks } from "@trigger.dev/sdk";
import { createDb } from "@vantera/db";
import { deriveIcpCriteria, rankLeads, scanWebsite } from "@vantera/agent-brains";
import { runScout } from "../pipeline/scout";
import { createPgStore } from "../pipeline/pg-store";
import { createCompanySignals, createProspectData } from "../pipeline/prospect-source";

/** One Scout (Prospect) Agent run: discover → gate → enrich → rank → chain copy-draft. */
export const scoutRun = task({
  id: "scout-run",
  // Per-tenant isolation (rule 13 scale): triggered with concurrencyKey=accountId, which partitions
  // this queue per account — one tenant's run never blocks another's, and a tenant runs one at a time.
  queue: { concurrencyLimit: 1 },
  maxDuration: 1800,
  run: async (payload: { agentId: string; accountId: string }) => {
    const store = createPgStore(createDb());
    let summary;
    try {
      summary = await runScout(payload.agentId, {
        store,
        prospectData: createProspectData(),
        companySignals: createCompanySignals(),
        scanFn: (url) => scanWebsite(url),
        rankFn: (candidates, ctx) => rankLeads(candidates, ctx),
        deriveCriteriaFn: (icpText, ctx) => deriveIcpCriteria(icpText, ctx),
        triggerCopyDraft: async (p) => {
          await tasks.trigger("copy-draft", p, { concurrencyKey: p.accountId });
        },
      });
    } catch (err) {
      // T4 operate path: a crashed run must be visible in-product, not just in ops logs.
      await store.recordAgentRun({ ...payload, kind: "scout", status: "failed", summary: {}, note: String(err).slice(0, 300) });
      throw err;
    }
    await store.recordAgentRun({
      ...payload,
      kind: "scout",
      status: summary.status,
      summary: { ...summary },
      note: summary.reason ?? null,
    });
    if (summary.reason === "low_credits") {
      // Ops alert: the shared prospect-data credit pool can't cover this run. The run skipped
      // before spending (no partial/mid-run hard-stop) — top up the pool to resume prospecting.
      logger.error("scout run skipped: prospect-data credit pool below this run's cost — top up to resume", {
        ...summary,
        agentId: payload.agentId,
        accountId: payload.accountId,
      });
    } else if (summary.discoveryTarget > 0 && summary.discovered === 0) {
      // Ops alert: discovery WANTED prospects and the source returned none — a dead search
      // (underivable criteria, provider outage, empty query). Never let this pass as healthy;
      // it once idled silently for 11 days (2026-07-08 dead-scout incident).
      logger.error("scout discovery returned zero prospects for a non-zero target", {
        ...summary,
        agentId: payload.agentId,
        accountId: payload.accountId,
      });
    } else {
      logger.info("scout run finished", { ...summary, agentId: payload.agentId });
    }
    return summary;
  },
});

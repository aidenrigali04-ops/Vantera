import { logger, task, tasks } from "@trigger.dev/sdk";
import { createDb } from "@vantera/db";
import { classifyIntent, rankLeads } from "@vantera/agent-brains";
import { createLinkedInInfraFromEnv } from "@vantera/linkedin-infra";
import { runIntentScan } from "../pipeline/intent-scan";
import { createPgStore } from "../pipeline/pg-store";

/** One Intent Agent run: read LinkedIn intent → classify → qualify against the ICP → enroll the
 *  qualified via copy-draft (same chain as the Scout). LinkedIn reads are ceilinged in the core
 *  for account-safety (rule 04). */
export const intentScan = task({
  id: "intent-scan",
  // Per-tenant isolation (rule 13 scale): triggered with concurrencyKey=accountId, partitioning
  // this queue per account so tenants never block each other.
  queue: { concurrencyLimit: 1 },
  maxDuration: 1800,
  run: async (payload: { agentId: string; accountId: string }) => {
    const store = createPgStore(createDb());
    let summary;
    try {
      summary = await runIntentScan(payload.agentId, {
        store,
        linkedin: createLinkedInInfraFromEnv(),
        classifyFn: (obs, ctx) => classifyIntent(obs, ctx),
        rankFn: (candidates, ctx) => rankLeads(candidates, ctx),
        triggerCopyDraft: async (p) => {
          await tasks.trigger("copy-draft", p, { concurrencyKey: p.accountId });
        },
      });
    } catch (err) {
      // T4 operate path: a crashed run must be visible in-product, not just in ops logs.
      await store.recordAgentRun({ ...payload, kind: "intent", status: "failed", summary: {}, note: String(err).slice(0, 300) });
      throw err;
    }
    await store.recordAgentRun({
      ...payload,
      kind: "intent",
      status: summary.status,
      summary: { ...summary },
      note: summary.reason ?? null,
    });
    if (summary.targets > 0 && summary.sourcingErrors === summary.targets) {
      // Ops alert: EVERY watch-target read failed — the LinkedIn connection is dead or rate
      // limited, not quiet. This once passed as "observed 0" for 2 days (2026-07-08 incident).
      logger.error("intent scan: every watch-target read failed — check the LinkedIn connection", {
        ...summary,
        agentId: payload.agentId,
        accountId: payload.accountId,
      });
      // Reconcile NOW: if the connection is dead this flips the status, shows the banner,
      // and emails the admins within minutes instead of waiting for the next cron tick.
      await tasks.trigger("account-health", {});
    } else if (summary.sourcingErrors > 0) {
      logger.warn("intent scan finished with partial sourcing failures", { ...summary, agentId: payload.agentId });
    } else {
      logger.info("intent scan finished", { ...summary, agentId: payload.agentId });
    }
    return summary;
  },
});

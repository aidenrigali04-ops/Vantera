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
  maxDuration: 1800,
  run: async (payload: { agentId: string; accountId: string }) => {
    const store = createPgStore(createDb());
    const summary = await runIntentScan(payload.agentId, {
      store,
      linkedin: createLinkedInInfraFromEnv(),
      classifyFn: (obs, ctx) => classifyIntent(obs, ctx),
      rankFn: (candidates, ctx) => rankLeads(candidates, ctx),
      triggerCopyDraft: async (p) => {
        await tasks.trigger("copy-draft", p);
      },
    });
    logger.info("intent scan finished", { ...summary, agentId: payload.agentId });
    return summary;
  },
});

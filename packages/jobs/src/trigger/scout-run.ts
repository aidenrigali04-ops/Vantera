import { logger, task, tasks } from "@trigger.dev/sdk";
import { createDb } from "@vantera/db";
import { rankLeads, scanWebsite } from "@vantera/agent-brains";
import { runScout } from "../pipeline/scout";
import { createPgStore } from "../pipeline/pg-store";
import { createProspectData } from "../pipeline/prospect-source";

/** One Scout (Prospect) Agent run: discover → gate → enrich → rank → chain copy-draft. */
export const scoutRun = task({
  id: "scout-run",
  maxDuration: 1800,
  run: async (payload: { agentId: string; accountId: string }) => {
    const store = createPgStore(createDb());
    const summary = await runScout(payload.agentId, {
      store,
      prospectData: createProspectData(),
      scanFn: (url) => scanWebsite(url),
      rankFn: (candidates, ctx) => rankLeads(candidates, ctx),
      triggerCopyDraft: async (p) => {
        await tasks.trigger("copy-draft", p);
      },
      triggerCallBrief: async (p) => {
        await tasks.trigger("call-brief", p);
      },
    });
    logger.info("scout run finished", { ...summary, agentId: payload.agentId });
    return summary;
  },
});

import { logger, schedules, tasks } from "@trigger.dev/sdk";
import { createDb } from "@vantera/db";
import { createPgStore } from "../pipeline/pg-store";
import { computeNextRunAt } from "../pipeline/schedule";

/**
 * Cron scan over live Scout agents. Schedule state lives in our DB
 * (agents.next_run_at) — pausing an agent is a status flip, no provider sync.
 */
export const agentScheduler = schedules.task({
  id: "agent-scheduler",
  cron: "*/15 * * * *",
  run: async () => {
    const store = createPgStore(createDb());
    const now = new Date();
    const due = await store.getDueScoutAgents(now);
    for (const agent of due) {
      await tasks.trigger("scout-run", { agentId: agent.id, accountId: agent.accountId });
      await store.advanceSchedule(
        agent.id,
        computeNextRunAt(agent.runAtTime ?? "08:00", agent.cadence ?? "daily", agent.timezone, now)
      );
    }
    logger.info("agent scheduler tick", { due: due.length });
    return { triggered: due.length };
  },
});

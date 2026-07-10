import { logger, schedules, tasks } from "@trigger.dev/sdk";
import { createDb } from "@vantera/db";
import { createPgStore } from "../pipeline/pg-store";
import { computeNextRunAt } from "../pipeline/schedule";

/**
 * Cron scan over live scheduled agents (Scout + Intent). Schedule state lives in our DB
 * (agents.next_run_at) — pausing an agent is a status flip, no provider sync. Each kind
 * dispatches its own run task.
 *
 * Also fires the account-health reconcile and the lifecycle-outreach tick each run (plain
 * tasks piggybacking this cron: the plan's schedule quota is at 10/10).
 */
export const agentScheduler = schedules.task({
  id: "agent-scheduler",
  cron: "*/15 * * * *",
  run: async () => {
    const store = createPgStore(createDb());
    const now = new Date();
    const due = await store.getDueAgents(now);
    for (const agent of due) {
      const taskId = agent.kind === "intent" ? "intent-scan" : "scout-run";
      await tasks.trigger(taskId, { agentId: agent.id, accountId: agent.accountId }, { concurrencyKey: agent.accountId });
      await store.advanceSchedule(
        agent.id,
        computeNextRunAt(agent.runAtTime ?? "08:00", agent.cadence ?? "daily", agent.timezone, now)
      );
    }
    await tasks.trigger("account-health", {});
    await tasks.trigger("lifecycle-outreach", {});
    logger.info("agent scheduler tick", { due: due.length });
    return { triggered: due.length };
  },
});

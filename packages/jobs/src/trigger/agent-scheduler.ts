import { idempotencyKeys, logger, schedules, tasks } from "@trigger.dev/sdk";
import { createDb } from "@vantera/db";
import { createPgStore } from "../pipeline/pg-store";
import { isHeldForOnboarding } from "../pipeline/onboarding-hold";
import { computeNextRunAt } from "../pipeline/schedule";

/**
 * Cron scan over live scheduled agents (Scout + Intent). Schedule state lives in our DB
 * (agents.next_run_at) — pausing an agent is a status flip, no provider sync. Each kind
 * dispatches its own run task.
 *
 * Also fires the account-health reconcile, the reply-backlog safeguard, the lifecycle-outreach
 * tick, the trial-ending heads-up, the pull-back email and the first-message scan each run, and the
 * hourly LinkedIn thread sync (plain tasks piggybacking
 * this cron: the plan's schedule quota is at 10/10 — an 11th schedule fails every deploy).
 */
export const agentScheduler = schedules.task({
  id: "agent-scheduler",
  cron: "*/15 * * * *",
  run: async () => {
    const store = createPgStore(createDb());
    const now = new Date();
    const due = await store.getDueAgents(now);
    for (const agent of due) {
      if (isHeldForOnboarding(agent)) {
        logger.info("held_onboarding", { agentId: agent.id });
        continue;
      }
      const taskId = agent.kind === "intent" ? "intent-scan" : "scout-run";
      await tasks.trigger(taskId, { agentId: agent.id, accountId: agent.accountId }, { concurrencyKey: agent.accountId });
      await store.advanceSchedule(
        agent.id,
        computeNextRunAt(agent.runAtTime ?? "08:00", agent.cadence ?? "daily", agent.timezone, now)
      );
    }
    await tasks.trigger("account-health", {});
    await tasks.trigger("reply-backlog", {});
    await tasks.trigger("lifecycle-outreach", {});
    await tasks.trigger("trial-ending", {});
    await tasks.trigger("pullback-email", {});
    // hourly: the key dedupes the four ticks inside one UTC hour down to a single run. GLOBAL
    // scope — a raw string key inside a task is scoped to this tick's run and would dedupe nothing.
    const threadSyncKey = await idempotencyKeys.create(`thread-sync:${now.toISOString().slice(0, 13)}`, {
      scope: "global",
    });
    await tasks.trigger("thread-sync", {}, { idempotencyKey: threadSyncKey });
    // daily: same global-key pattern; the learner is idempotent but only needs one run a day
    const learnKey = await idempotencyKeys.create(`conversation-learn:${now.toISOString().slice(0, 10)}`, {
      scope: "global",
    });
    await tasks.trigger("conversation-learn", {}, { idempotencyKey: learnKey });
    // every tick, no key: the connected-without-first-message scan is cheap and idempotent
    await tasks.trigger("first-message", {});
    logger.info("agent scheduler tick", { due: due.length });
    return { triggered: due.length };
  },
});

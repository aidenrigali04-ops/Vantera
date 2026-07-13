import { logger, task } from "@trigger.dev/sdk";
import { createDb } from "@vantera/db";
import { runReplyBacklog } from "../pipeline/reply-backlog";
import { createReplyBacklogStore } from "../pipeline/pg-store";

/**
 * Stale-reply safeguard: escalate respondable replies that have sat unanswered — no reply sent, no
 * draft queued, no human on the thread — to a needs_human alert so an orphaned reply never rots
 * silently (the "ensure this never happens again" fix). Idempotent: one alert per orphaned reply.
 *
 * A plain task fired from the agent-scheduler tick (every 15 min), NOT its own cron — the Trigger
 * plan's schedule quota is 10/10 (same reason as account-health), and a piggybacked tick meets its
 * loose timing needs.
 */
export const replyBacklog = task({
  id: "reply-backlog",
  maxDuration: 300,
  run: async () => {
    const summary = await runReplyBacklog({
      store: createReplyBacklogStore(createDb()),
      now: () => new Date(),
    });
    if (summary.escalated > 0) {
      logger.warn("reply backlog: orphaned replies escalated to needs_human", { ...summary });
    } else {
      logger.info("reply backlog tick", { ...summary });
    }
    return summary;
  },
});

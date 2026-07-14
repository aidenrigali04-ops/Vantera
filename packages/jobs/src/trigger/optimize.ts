import { logger, schedules } from "@trigger.dev/sdk";
import { createDb } from "@vantera/db";
import { proposeRecipeCandidates } from "@vantera/agent-brains";
import { createPgStore } from "../pipeline/pg-store";
import { runOptimize } from "../pipeline/optimize";

/**
 * Daily: evaluate running experiments, conclude the decisive ones, and act autonomously within
 * the envelope (spec 2026-07-14): winners are adopted on the spot, losers discarded, harmful
 * challengers halted — then the next test is chained via generate→gate→bandit (Stage 1b):
 * LLM-proposed candidates, deterministically gated, Thompson-sampled against the collective
 * recipe aggregates. The decide gate + circuit breaker remain the unchanged adjudicator.
 */
export const optimize = schedules.task({
  id: "optimize",
  cron: "0 6 * * *",
  run: async () => {
    const summary = await runOptimize({
      store: createPgStore(createDb()),
      proposeCandidatesFn: (input) => proposeRecipeCandidates(input),
    });
    logger.info("optimize finished", { ...summary });
    return summary;
  },
});

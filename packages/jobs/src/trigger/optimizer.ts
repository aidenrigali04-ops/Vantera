import { logger, task } from "@trigger.dev/sdk";
import { releaseWorldCache } from "@vantera/agent-brains";
import { runOptimizer } from "../pipeline/optimizer";

/**
 * One subject run. Calibration refresh and a proposal are the only steps wired today.
 * A proposal is not launched. This task is not a cron — the agent scheduler fires it
 * when a live subject is due.
 */
export const optimizer = task({
  id: "optimizer",
  queue: { concurrencyLimit: 1 },
  maxDuration: 300,
  run: async (payload: { agentId: string; accountId: string }) => {
    const summary = await runOptimizer(payload, {
      async refreshCalibration() {
        // The daily calibration task already fits live subjects. This hook is where a
        // later phase refreshes one account immediately before a proposal.
      },
      async propose() {
        return null;
      },
      releaseWorldCache,
    });
    logger.info("optimizer finished", { agentId: payload.agentId, ...summary });
    return summary;
  },
});

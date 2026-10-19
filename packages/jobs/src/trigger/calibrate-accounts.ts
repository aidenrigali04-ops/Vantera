import { logger, task } from "@trigger.dev/sdk";
import { createDb } from "@vantera/db";
import { releaseWorldCache } from "@vantera/agent-brains";
import { createPgStore } from "../pipeline/pg-store";
import { runAccountCalibration } from "../pipeline/calibrate-accounts";

/**
 * Fit each live subject's funnel base rates and check them on the later window.
 *
 * A plain task fired from the agent-scheduler tick, not its own cron. The schedule
 * quota is 10/10. The core skips a subject calibrated in the last day, and it skips
 * every account that has no subject.
 */
export const calibrateAccounts = task({
  id: "calibrate-accounts",
  maxDuration: 300,
  run: async () => {
    const store = createPgStore(createDb());
    const summary = await runAccountCalibration(
      {
        listSubjects: () => store.listCalibrationSubjects(),
        getCohort: (accountId, window) => store.getFunnelCohort(accountId, window),
        saveCalibration: (agentId, accountId, calibration) => store.saveCalibration(agentId, accountId, calibration),
        releaseWorldCache,
      },
      new Date()
    );
    logger.info("calibrate-accounts finished", { ...summary });
    return summary;
  },
});

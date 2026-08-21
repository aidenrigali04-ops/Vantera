import { logger, schedules } from "@trigger.dev/sdk";
import { createDb } from "@vantera/db";
import { proposeRecipeCandidates } from "@vantera/agent-brains";
import { createAccountHealthStore, createPgStore } from "../pipeline/pg-store";
import { runOptimize } from "../pipeline/optimize";
import { createCanaryAlertNotifier } from "../pipeline/canary-alert";

/**
 * Daily: evaluate running experiments, conclude the decisive ones, and act autonomously within
 * the envelope (spec 2026-07-14): winners are adopted on the spot, losers discarded, harmful
 * challengers halted — then the next test is chained via generate→gate→bandit (Stage 1b):
 * LLM-proposed candidates, deterministically gated, Thompson-sampled against the collective
 * recipe aggregates. The decide gate + circuit breaker remain the unchanged adjudicator.
 *
 * Live A/A canary (WS-1.8): before evaluating, seed an identical-arm experiment on the
 * app-setting-pinned account (`aa_canary_account_id`) if one isn't already live — idempotent via
 * the one-live unique index. A decisive verdict on it is a false signal from the decide gate
 * itself; it alerts the account's admins instead of acting (same lookup account-health.ts uses
 * for its disconnect alert), and never chains or mutates the playbook.
 */
export const optimize = schedules.task({
  id: "optimize",
  cron: "0 6 * * *",
  run: async () => {
    const db = createDb();
    const store = createPgStore(db);
    const healthStore = createAccountHealthStore(db);

    const [canaryAccountId, boldShapesAccountIds, messageShapeAuto] = await Promise.all([
      store.getCanaryAccountId(),
      store.getBoldShapesAccountIds(),
      store.getMessageShapeAuto(),
    ]);
    if (canaryAccountId) await store.ensureCanaryExperiment(canaryAccountId);

    const summary = await runOptimize({
      store,
      canaryAccountId,
      // Master gate (review M-gate): message_shape_auto enables shape PROPOSALS in generation, not
      // just the champion default in copy-draft — so the feature is truly OFF end-to-end by default.
      messageShapeAuto,
      boldShapesAccountIds,
      proposeCandidatesFn: (input) => proposeRecipeCandidates(input),
      notifyCanaryAlert: createCanaryAlertNotifier(healthStore),
    });
    logger.info("optimize finished", { ...summary });
    return summary;
  },
});

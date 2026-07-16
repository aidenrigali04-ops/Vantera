import { logger, schedules } from "@trigger.dev/sdk";
import { createDb } from "@vantera/db";
import { proposeRecipeCandidates } from "@vantera/agent-brains";
import { createTransactionalEmailFromEnv } from "@vantera/transactional-email";
import { createAccountHealthStore, createPgStore } from "../pipeline/pg-store";
import { runOptimize } from "../pipeline/optimize";

const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

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
    const mailer = createTransactionalEmailFromEnv();
    const healthStore = createAccountHealthStore(db);

    const canaryAccountId = await store.getCanaryAccountId();
    if (canaryAccountId) await store.ensureCanaryExperiment(canaryAccountId);

    const summary = await runOptimize({
      store,
      proposeCandidatesFn: (input) => proposeRecipeCandidates(input),
      notifyCanaryAlert: async (info) => {
        logger.error("A/A canary fired a decisive verdict — decide gate miscalibration", { ...info });
        const subject = "A/A canary alert: decide gate produced a decisive verdict";
        const text = [
          "The live A/A canary (identical champion/challenger arms) produced a decisive verdict.",
          "This is a false-signal calibration failure in the decide gate itself — no action was taken; the experiment keeps collecting.",
          "",
          `Experiment: ${info.experimentId}`,
          `Account: ${info.accountId}`,
          `Decision: ${info.decision}`,
          `Reason: ${info.reason}`,
        ].join("\n");
        const html = [
          `<p><strong>${esc(subject)}</strong></p>`,
          `<p>The live A/A canary (identical champion/challenger arms) produced a decisive verdict. This is a false-signal calibration failure in the decide gate itself — no action was taken; the experiment keeps collecting.</p>`,
          `<p>Experiment: ${esc(info.experimentId)}<br/>Account: ${esc(info.accountId)}<br/>Decision: ${esc(info.decision)}<br/>Reason: ${esc(info.reason)}</p>`,
        ].join("\n");
        const emails = await healthStore.getAccountAdminEmails(info.accountId);
        for (const to of emails) {
          try {
            await mailer.send({ to, subject, html, text });
          } catch {
            // alert is best-effort; the error above already captured the signal in task logs
          }
        }
      },
    });
    logger.info("optimize finished", { ...summary });
    return summary;
  },
});

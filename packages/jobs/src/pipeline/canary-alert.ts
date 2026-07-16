import { logger } from "@trigger.dev/sdk";
import { createTransactionalEmailFromEnv, type TransactionalEmail } from "@vantera/transactional-email";
import type { AccountHealthStore } from "./account-health";

/**
 * The live A/A canary alert (WS-1.8), factored out of the trigger wrapper so it stays a thin
 * wrapper (rule 13's 80-line guardrail — `structure.test.ts`).
 *
 * The mailer is constructed LAZILY, on first use, inside the returned notifier (review-round
 * fix): building it at the optimize task's top level meant a missing RESEND env killed the
 * ENTIRE optimize cron — the discard/halt/chain loop included, not just this best-effort alert.
 * A construction failure here is logged and swallowed; only the alert is skipped.
 */
export function createCanaryAlertNotifier(healthStore: Pick<AccountHealthStore, "getAccountAdminEmails">) {
  const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

  return async (info: {
    experimentId: string;
    accountId: string;
    decision: string;
    reason: string;
  }): Promise<void> => {
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

    let mailer: TransactionalEmail;
    try {
      mailer = createTransactionalEmailFromEnv();
    } catch (err) {
      logger.error("optimize: canary alert mailer unavailable — RESEND env missing, alert skipped", {
        error: err instanceof Error ? err.message : String(err),
      });
      return;
    }
    const emails = await healthStore.getAccountAdminEmails(info.accountId);
    for (const to of emails) {
      try {
        await mailer.send({ to, subject, html, text });
      } catch {
        // alert is best-effort; the error above already captured the signal in task logs
      }
    }
  };
}

import { createTransactionalEmailFromEnv } from "./resend";

/**
 * Lifecycle emails (R5, spec 2026-07-15): the three moments the email channel was silent —
 * welcome at signup, trial ending in ~2 days, payment failed. Copy is honest, one CTA each,
 * no invented numbers, no she/her for Vera. Owners/admins only; the account-level toggle
 * (lifecycle_emails_enabled) governs trial-ending + dunning; welcome rides signup itself.
 */

function shell(title: string, lines: string[], ctaLabel: string, ctaUrl: string): { html: string; text: string } {
  const html = `
<!DOCTYPE html>
<html lang="en">
<head><meta charset="UTF-8" /><meta name="viewport" content="width=device-width, initial-scale=1.0" /></head>
<body style="font-family:sans-serif;background:#fff;color:#111;margin:0;padding:40px 24px">
  <h1 style="font-size:19px;font-weight:700;margin:0 0 12px">${title}</h1>
  ${lines.map((l) => `<p style="margin:0 0 14px;font-size:15px;color:#444">${l}</p>`).join("\n  ")}
  <a href="${ctaUrl}"
     style="display:inline-block;background:#111;color:#fff;text-decoration:none;
            padding:12px 24px;border-radius:6px;font-size:15px;font-weight:600">
    ${ctaLabel}
  </a>
  <p style="margin:24px 0 0;font-size:12px;color:#888">
    You can adjust these emails in Settings → Notifications.
  </p>
</body>
</html>`.trim();
  const text = [title, "", ...lines, "", `${ctaLabel}: ${ctaUrl}`].join("\n").trim();
  return { html, text };
}

export interface WelcomeEmailOptions {
  to: string;
  appUrl: string;
}

/** Sent once at signup — the first email a new user ever gets (previously: none for 7 days). */
export async function sendWelcomeEmail(opts: WelcomeEmailOptions): Promise<void> {
  const mailer = createTransactionalEmailFromEnv();
  const subject = "Welcome to Vantera — here's how it starts";
  const { html, text } = shell(
    subject,
    [
      "Your workspace is ready. Two steps stand between you and a working pipeline:",
      "1. Finish the short setup — Vantera maps your ICP and matches proven plays to it.",
      "2. Connect LinkedIn. Your 7-day free trial only starts counting the moment you do, and your agents start sourcing and qualifying prospects the same day.",
      "Everything the agents draft waits for your approval — nothing sends without you.",
    ],
    "Open Vantera",
    `${opts.appUrl}/dashboard`
  );
  await mailer.send({ to: opts.to, subject, html, text });
}

export interface TrialEndingEmailOptions {
  to: string;
  daysLeft: number;
  appUrl: string;
}

/** Sent once, ~2 days before the trial ends (cron, idempotence-stamped). */
export async function sendTrialEndingEmail(opts: TrialEndingEmailOptions): Promise<void> {
  const mailer = createTransactionalEmailFromEnv();
  const days = Math.max(1, opts.daysLeft);
  const subject =
    days === 1 ? "Your Vantera trial ends tomorrow" : `Your Vantera trial ends in ${days} days`;
  const { html, text } = shell(
    subject,
    [
      `Your free trial ends in ${days === 1 ? "1 day" : `${days} days`}. When it does, your agents pause — nothing is deleted, and your leads, conversations, and history stay exactly as they are.`,
      "Pick a plan to keep the pipeline running without interruption.",
    ],
    "Choose a plan",
    `${opts.appUrl}/settings/billing`
  );
  await mailer.send({ to: opts.to, subject, html, text });
}

export interface PaymentFailedEmailOptions {
  to: string;
  appUrl: string;
}

/** Sent once per past_due spell (stamp cleared when the subscription recovers). */
export async function sendPaymentFailedEmail(opts: PaymentFailedEmailOptions): Promise<void> {
  const mailer = createTransactionalEmailFromEnv();
  const subject = "Your Vantera payment didn't go through";
  const { html, text } = shell(
    subject,
    [
      "The latest charge on your subscription failed, so new outreach is paused until billing is active again.",
      "Your data and agents are untouched — updating your payment method picks everything back up where it left off.",
    ],
    "Fix payment",
    `${opts.appUrl}/settings/billing`
  );
  await mailer.send({ to: opts.to, subject, html, text });
}

export interface PullbackEmailOptions {
  to: string;
  subject: string;
  lines: string[];
  ctaLabel: string;
  ctaUrl: string;
  /** RFC 8058 one-click opt-out URL — a lapsed user cannot be asked to log in. */
  unsubscribeUrl: string;
}

/**
 * Pull-back email (spec 2026-07-18): the leads or drafts already waiting, named. Copy is composed
 * upstream by composePullback so every claim is grounded in the user's real data.
 */
export async function sendPullbackEmail(opts: PullbackEmailOptions): Promise<void> {
  const mailer = createTransactionalEmailFromEnv();
  const { html, text } = shell(opts.subject, opts.lines, opts.ctaLabel, opts.ctaUrl);
  await mailer.send({
    to: opts.to,
    subject: opts.subject,
    html,
    text,
    headers: {
      "List-Unsubscribe": `<${opts.unsubscribeUrl}>`,
      "List-Unsubscribe-Post": "List-Unsubscribe=One-Click",
    },
  });
}

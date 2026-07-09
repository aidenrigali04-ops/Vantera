import { dailyAllowance, paceWithJitter } from "./safety-limits";
import { isWithinSendWindow } from "./send-window";
import { buildLifecycleMessage, firstNameOf } from "./lifecycle-copy";
import type { LifecycleOutreachDeps, LifecycleOutreachSummary } from "./types";

// Operator-side lifecycle re-engagement (0045). Deliberately BYPASSES the campaign/lead
// machinery — targets are our own users, not prospects — but keeps the same safety
// posture: rule-04 ceilings, business-hours window, jittered pacing, kill switch, and a
// stop-on-reply contract (a user who replies is never auto-messaged again; the founder
// takes the thread over personally in their real inbox).

/** Gap between consecutive founder-account sends (jittered ±30%) — human pacing. */
export const LIFECYCLE_SEND_GAP_MS = 120_000;
/** Once-a-day gate: a run inside the last 20h makes this tick a no-op (fired every 15 min). */
export const LIFECYCLE_RUN_GAP_MS = 20 * 3_600_000;
/**
 * Admin pin (owner directive 2026-07-09): lifecycle sends run ONLY from a LinkedIn identity
 * connected under the account owned by this email. Any other configured sender is refused —
 * this capability never applies to another account.
 */
export const LIFECYCLE_ADMIN_EMAIL = "aiden@vanterasystem.com";

const seedFor = (s: string) => [...s].reduce((a, c) => a + c.charCodeAt(0), 0);
const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

/** "someone replied" — the founder picks the thread up personally from their LinkedIn inbox. */
export function buildLifecycleReplyAlert(to: string, name: string | null, body: string) {
  const who = name ?? "A lifecycle contact";
  const text = [
    `${who} replied to your lifecycle message:`,
    "",
    body,
    "",
    "Reply personally from your LinkedIn inbox. Automated touches for them are stopped.",
  ].join("\n");
  const html = [
    `<p><strong>${esc(who)} replied to your lifecycle message.</strong></p>`,
    `<blockquote>${esc(body)}</blockquote>`,
    `<p>Reply personally from your LinkedIn inbox. Automated touches for them are stopped.</p>`,
  ].join("\n");
  return { to, subject: `${who} replied to your lifecycle outreach`, html, text };
}

export function buildSenderDownAlert(to: string) {
  const text =
    "Lifecycle outreach is paused: the founder LinkedIn connection is not active. Reconnect it in the ops workspace, then the next run resumes automatically.";
  return { to, subject: "Lifecycle outreach paused: sender connection down", html: `<p>${esc(text)}</p>`, text };
}

export async function runLifecycleOutreach(deps: LifecycleOutreachDeps): Promise<LifecycleOutreachSummary> {
  const now = deps.now?.() ?? new Date();
  const none = { enqueued: 0, followUps: 0, messagesSent: 0, invitesSent: 0, skipped: 0, failed: 0 };

  const config = await deps.store.getLifecycleConfig();
  if (!config.enabled || !config.senderRef) return { status: "skipped", reason: "disabled", ...none };
  if (await deps.store.isKillSwitchOn()) return { status: "skipped", reason: "kill_switch", ...none };
  if (!isWithinSendWindow(now, config.senderLocation)) return { status: "skipped", reason: "outside_window", ...none };
  if (config.lastRunAt && now.getTime() - config.lastRunAt.getTime() < LIFECYCLE_RUN_GAP_MS)
    return { status: "skipped", reason: "already_ran", ...none };

  const sender = await deps.store.getSenderRow(config.senderRef);
  if (!sender || sender.status !== "active") {
    // a dead personal-account session must be loud but never re-alert every 15 minutes —
    // stamping the run gate makes it once-a-day
    await deps.store.setLifecycleLastRun(now);
    if (config.notifyEmail) {
      try {
        await deps.send(buildSenderDownAlert(config.notifyEmail));
      } catch {
        /* best-effort */
      }
    }
    return { status: "skipped", reason: "sender_unavailable", ...none };
  }

  // admin pin: the sender identity must live under the admin workspace — refuse anything else
  const ownerEmails = await deps.store.getAccountOwnerEmails(sender.accountId);
  if (!ownerEmails.includes(LIFECYCLE_ADMIN_EMAIL)) {
    await deps.store.setLifecycleLastRun(now);
    return { status: "skipped", reason: "sender_not_admin", ...none };
  }

  // scan → enqueue (idempotent; the unique index swallows re-scans)
  let enqueued = 0;
  const scans = [
    ["stalled_onboarding", await deps.store.scanStalledOnboarding(now, sender.accountId)],
    ["idle_after_onboarding", await deps.store.scanIdleAfterOnboarding(now, sender.accountId)],
    ["trial_lapsed", await deps.store.scanTrialLapsedBackfill(now, sender.accountId)],
  ] as const;
  for (const [segment, candidates] of scans) {
    for (const c of candidates) {
      await deps.store.enqueueTouch(c, segment, 1);
      enqueued += 1;
    }
  }
  const followUps = await deps.store.enqueueDueFollowUps(now);

  // send under the personal-account ceiling (rule 04 clamps a misconfigured cap)
  const senderAgeDays = sender.connectedAt
    ? (now.getTime() - sender.connectedAt.getTime()) / 86_400_000
    : 0;
  const cap = dailyAllowance("linkedin", senderAgeDays, { requested: config.dailyCap, kind: "message" });
  const due = await deps.store.getDueTouches(now, cap);

  let messagesSent = 0;
  let invitesSent = 0;
  let skipped = 0;
  let failed = 0;
  let i = 0;
  for (const t of due) {
    if (i > 0) await deps.pause?.(paceWithJitter(LIFECYCLE_SEND_GAP_MS, seedFor(t.id)));
    i += 1;
    if (!t.linkedinUrl) {
      // LinkedIn-only (owner decision): no URL means no touch, ever
      await deps.store.markTouchSkipped(t.id);
      skipped += 1;
      continue;
    }
    try {
      const connected = t.connected
        ? true
        : (
            await deps.linkedin.getConnectionState({
              connectedAccountId: config.senderRef,
              profileUrl: t.linkedinUrl,
            })
          ).connected;
      if (connected) {
        const body = buildLifecycleMessage(
          t.segment,
          t.touchNumber,
          {
            firstName: firstNameOf(t.displayName),
            stalledStep: t.stalledStep,
            leadCount: t.leadCount,
            qualifiedCount: t.qualifiedCount,
          },
          seedFor(t.userId)
        );
        const out = await deps.linkedin.sendMessage({
          connectedAccountId: config.senderRef,
          profileUrl: t.linkedinUrl,
          body,
        });
        await deps.store.markTouchSent(t.id, {
          messageRef: out.id,
          body,
          targetProviderRef: out.prospectProviderRef ?? null,
          sentAt: now,
        });
        messagesSent += 1;
      } else if (!t.inviteSent) {
        // invite gate: DMs need a 1st-degree connection; ONE note-less invite, then wait
        // for the acceptance webhook to flip the row back to 'pending'
        const out = await deps.linkedin.sendInvite({
          connectedAccountId: config.senderRef,
          profileUrl: t.linkedinUrl,
        });
        await deps.store.markTouchInvited(t.id, out.prospectProviderRef ?? null, now);
        invitesSent += 1;
      } else {
        // invited + still not connected — parked; getDueTouches shouldn't return this, guard anyway
        skipped += 1;
      }
    } catch (e) {
      await deps.store.markTouchFailed(t.id, e instanceof Error ? e.message : String(e));
      failed += 1;
    }
  }

  await deps.store.setLifecycleLastRun(now);
  return { status: "completed", enqueued, followUps, messagesSent, invitesSent, skipped, failed };
}

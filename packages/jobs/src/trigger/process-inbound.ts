import { logger, task, tasks } from "@trigger.dev/sdk";
import { createDb } from "@vantera/db";
import { classifyReply, draftConversationMessage, fixConversationMessage } from "@vantera/agent-brains";
import { createLinkedInInfraFromEnv } from "@vantera/linkedin-infra";
import { createTransactionalEmailFromEnv, sendLeadEventEmail } from "@vantera/transactional-email";
import { runInbound } from "../pipeline/inbound";
import { buildLifecycleReplyAlert } from "../pipeline/lifecycle-outreach";
import { createLeadEventNotifier } from "../pipeline/lead-event-emails";
import { createLeadEventEmailStore, createLifecycleStore, createPgStore } from "../pipeline/pg-store";
import type { InboundPayload } from "../pipeline/types";

/**
 * Routes verified LinkedIn webhook events: replies, connection acceptances, account state.
 * On a genuine, non-terminal reply the active responder drafts the seller's next message with
 * the SAME grounding + humanizer as the outreach copy and queues it for delivery — continuing the
 * conversation toward close (auto-sent in 'automatic' mode, queued for review otherwise).
 */
export const processInbound = task({
  id: "process-inbound",
  maxDuration: 600,
  run: async (payload: InboundPayload) => {
    const db = createDb();
    const store = createPgStore(db);
    const lifecycleStore = createLifecycleStore(db);
    // lifecycle is an add-on: a failed config read must never block tenant inbound processing
    const lifecycleConfig = await lifecycleStore.getLifecycleConfig().catch((err) => {
      // degraded mode must be diagnosable: lifecycle interception is silently off for this event
      logger.warn("lifecycle config read failed; lifecycle interception skipped", { err: String(err) });
      return null;
    });
    const senderRef = lifecycleConfig?.senderRef ?? null;
    const notifyEmail = lifecycleConfig?.notifyEmail ?? null;
    const summary = await runInbound(payload, {
      store,
      linkedinInfra: createLinkedInInfraFromEnv(),
      classifyFn: (body) => classifyReply(body),
      respondFn: (input) => draftConversationMessage(input),
      fixReplyFn: (original, input) => fixConversationMessage(original, input),
      // L3: interested-reply / booked / needs-you emails — the trial's pull-back channel
      notifyLeadEvent: (e) =>
        createLeadEventNotifier({
          getTargets: createLeadEventEmailStore(db).getTargets,
          send: sendLeadEventEmail,
          appUrl: process.env.NEXT_PUBLIC_SITE_URL ?? "https://www.vanterasystem.dev",
        })(e).catch((err) => {
          logger.warn("lead-event email failed", { err: String(err) });
        }),
      // 0045: intercept events on the founder identity (stop-on-reply + invite acceptance)
      lifecycle: senderRef
        ? {
            senderRef,
            recordReply: (who, now) => lifecycleStore.recordLifecycleReply(who, now),
            recordAcceptance: (who, now) => lifecycleStore.recordLifecycleAcceptance(who, now),
            notifyReply: async (name, body) => {
              if (!notifyEmail) return;
              await createTransactionalEmailFromEnv().send(
                buildLifecycleReplyAlert(notifyEmail, name, body)
              );
            },
          }
        : undefined,
    });
    if (summary.action.endsWith("+responded")) {
      // Speed-to-lead: a response just queued on the priority lane — run dispatch NOW instead
      // of waiting for the next cron tick, so the prospect hears back in ~1-2 minutes.
      await tasks.trigger("send-dispatch", {});
    }
    logger.info("inbound processed", { source: payload.source, ...summary });
    return summary;
  },
});

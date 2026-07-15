import { logger, task, tasks } from "@trigger.dev/sdk";
import { sql } from "drizzle-orm";
import { createDb } from "@vantera/db";
import { classifyReply, draftConversationMessage, fixConversationMessage } from "@vantera/agent-brains";
import { createLinkedInInfraFromEnv } from "@vantera/linkedin-infra";
import { createTransactionalEmailFromEnv, sendLeadEventEmail, type LeadEventKind } from "@vantera/transactional-email";
import { runInbound } from "../pipeline/inbound";
import { buildLifecycleReplyAlert } from "../pipeline/lifecycle-outreach";
import { createLifecycleStore, createPgStore } from "../pipeline/pg-store";
import type { InboundPayload } from "../pipeline/types";

const APP_URL = process.env.NEXT_PUBLIC_SITE_URL ?? "https://www.vanterasystem.dev";
const EVENT_URL: Record<LeadEventKind, (leadId: string) => string> = {
  interested_reply: (id) => `${APP_URL}/inbox?lead=${id}`,
  needs_human: (id) => `${APP_URL}/inbox?lead=${id}`,
  meeting_booked: () => `${APP_URL}/meetings`,
};

/** L3 moment-of-value emails: pref check + owner/admin lookup + send. Best-effort. */
async function emailLeadEvent(
  db: ReturnType<typeof createDb>,
  e: { kind: LeadEventKind; accountId: string; leadId: string; snippet: string }
): Promise<void> {
  const rows = await db.execute<{ email: string | null; enabled: boolean; name: string | null }>(sql`
    select u.email, a.lead_event_emails_enabled as enabled,
           nullif(trim(concat(l.first_name, ' ', l.last_name)), '') as name
    from public.accounts a
    join public.account_members m on m.account_id = a.id and m.role in ('owner','admin')
    join auth.users u on u.id = m.user_id
    left join public.leads l on l.id = ${e.leadId}
    where a.id = ${e.accountId}
  `);
  const list = [...rows];
  if (list.length === 0 || list[0]?.enabled === false) return;
  const leadName = list[0]?.name ?? "A prospect";
  for (const r of list) {
    if (!r.email) continue;
    await sendLeadEventEmail({
      to: r.email,
      kind: e.kind,
      leadName,
      snippet: e.snippet.slice(0, 400),
      url: EVENT_URL[e.kind](e.leadId),
    });
  }
}

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
        emailLeadEvent(db, e).catch((err) => {
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

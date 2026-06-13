import { appendComplianceFooter } from "./email-footer";
import { normalizeLinkedInUrl } from "./copy-draft";
import type { OutreachSendDeps, OutreachSendOutcome } from "./types";

export const LINKEDIN_NOTE_MAX = 200;

/**
 * scheduled_sends.error is one select away from a user surface, and adapter
 * errors append up to 300 chars of raw provider response after the first
 * colon — strip that detail (it stays in task logs) and keep the neutral prefix.
 */
export function sanitizeSendError(err: unknown): string {
  const message = err instanceof Error ? err.message : String(err);
  const detailStart = message.indexOf(": ");
  return detailStart === -1 ? message : message.slice(0, detailStart);
}

/**
 * One live send. Re-checks suppression, kill switch, pause and identity health
 * immediately before the provider call (rule 11) — dispatch-time checks are not
 * trusted across the delay.
 */
export async function runOutreachSend(
  payload: { sendId: string },
  deps: OutreachSendDeps
): Promise<OutreachSendOutcome> {
  const now = deps.now?.() ?? new Date();
  const ctx = await deps.store.getSendContext(payload.sendId);
  if (!ctx || ctx.status !== "scheduled") return "skipped";

  if ((await deps.store.isKillSwitchOn()) || ctx.accountPaused || ctx.campaignStatus !== "active") {
    await deps.store.revertToApproved(ctx.id);
    return "parked";
  }

  const target =
    ctx.channel === "email"
      ? ctx.lead.email?.toLowerCase() ?? null
      : ctx.lead.linkedinUrl ? normalizeLinkedInUrl(ctx.lead.linkedinUrl) : null;
  if (!target) {
    await deps.store.markFailed(ctx.id, "missing contact info");
    return "failed";
  }
  if (await deps.store.isSuppressed(ctx.accountId, ctx.channel, target)) {
    await deps.store.markSuppressed(ctx.id);
    await deps.store.setCampaignLeadStatus(ctx.campaignId, ctx.leadId, "suppressed");
    return "suppressed";
  }

  if (!(await deps.store.claimSending(ctx.id))) return "skipped";

  // ── Provider call ────────────────────────────────────────────────────────────
  // Only the provider call is wrapped in try/catch so that markFailed is ONLY
  // possible when the message was never delivered. If the provider succeeds but
  // bookkeeping later throws, the error propagates (the row stays "sending").
  //
  // Invariant: the dispatcher never re-dispatches "sending" rows, and
  // getSendContext's `status !== "scheduled"` guard makes any task retry a no-op,
  // so there is zero double-send risk. A stuck "sending" row is the ops signal
  // that bookkeeping needs a manual fix.
  let providerResult:
    | { channel: "email"; mailboxId: string; messageId: string }
    | { channel: "linkedin"; linkedinAccountId: string; messageRef: string | null; inviteSent: boolean }
    | { parked: true };

  try {
    if (ctx.channel === "email") {
      const mailbox = await deps.store.pickActiveMailbox(ctx.accountId);
      // belt-and-braces: the store filters to active, the core refuses anything else
      if (!mailbox || mailbox.status !== "active" || !mailbox.providerRef || !ctx.senderAddress) {
        await deps.store.revertToApproved(ctx.id);
        return "parked";
      }
      const token = await deps.store.createUnsubscribeToken(ctx.accountId, ctx.leadId, target);
      const unsubscribeUrl = `${deps.appUrl}/api/unsubscribe/${token}`;
      const body = appendComplianceFooter(ctx.body ?? "", unsubscribeUrl, ctx.senderAddress);
      const result = await deps.emailInfra.send({
        mailboxId: mailbox.providerRef,
        to: target,
        subject: ctx.subject ?? "",
        body,
        campaignId: ctx.campaignId,
        leadId: ctx.leadId,
        unsubscribeUrl,
      });
      providerResult = { channel: "email", mailboxId: mailbox.id, messageId: result.messageId };
    } else {
      const identity = await deps.store.getActiveLinkedInIdentity(ctx.accountId);
      if (!identity || identity.status !== "active") {
        await deps.store.revertToApproved(ctx.id);
        return "parked";
      }
      let messageRef: string | null = null;
      let inviteSent = false;
      if (ctx.linkedinStage === "message") {
        const r = await deps.linkedinInfra.sendMessage({
          connectedAccountId: identity.providerRef,
          profileUrl: ctx.lead.linkedinUrl as string,
          body: ctx.body ?? "",
        });
        messageRef = r.id;
      } else {
        const r = await deps.linkedinInfra.sendInvite({
          connectedAccountId: identity.providerRef,
          profileUrl: ctx.lead.linkedinUrl as string,
          note: (ctx.body ?? "").slice(0, LINKEDIN_NOTE_MAX),
        });
        messageRef = r.id;
        inviteSent = true;
      }
      providerResult = { channel: "linkedin", linkedinAccountId: identity.id, messageRef, inviteSent };
    }
  } catch (err) {
    await deps.store.markFailed(ctx.id, sanitizeSendError(err));
    return "failed";
  }

  if ("parked" in providerResult) return "parked";

  // ── Post-send bookkeeping (OUTSIDE the try/catch) ────────────────────────────
  // Rule 11: audit row first — recordOutreachSend before markSent so the audit
  // trail is never absent for a row the DB considers "sent".
  // Any throw here propagates; see invariant comment above.
  if (providerResult.channel === "email") {
    await deps.store.recordOutreachSend({
      accountId: ctx.accountId, campaignId: ctx.campaignId, leadId: ctx.leadId,
      scheduledSendId: ctx.id, channel: "email",
      mailboxId: providerResult.mailboxId, messageRef: providerResult.messageId,
    });
    await deps.store.markSent(ctx.id);
  } else {
    if (providerResult.inviteSent) {
      await deps.store.setLeadInvited(ctx.leadId, now);
    }
    await deps.store.recordOutreachSend({
      accountId: ctx.accountId, campaignId: ctx.campaignId, leadId: ctx.leadId,
      scheduledSendId: ctx.id, channel: "linkedin",
      linkedinAccountId: providerResult.linkedinAccountId, messageRef: providerResult.messageRef,
    });
    await deps.store.markSent(ctx.id);
  }
  await deps.store.setCampaignLeadStatus(ctx.campaignId, ctx.leadId, "sent");
  return "sent";
}

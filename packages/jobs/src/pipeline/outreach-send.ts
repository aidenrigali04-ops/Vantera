import { appendComplianceFooter } from "./email-footer";
import { normalizeLinkedInUrl } from "./copy-draft";
import type { OutreachSendDeps, OutreachSendOutcome } from "./types";

export const LINKEDIN_NOTE_MAX = 200;

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
      await deps.store.markSent(ctx.id);
      await deps.store.recordOutreachSend({
        accountId: ctx.accountId, campaignId: ctx.campaignId, leadId: ctx.leadId,
        scheduledSendId: ctx.id, channel: "email", mailboxId: mailbox.id, messageRef: result.messageId,
      });
    } else {
      const identity = await deps.store.getActiveLinkedInIdentity(ctx.accountId);
      if (!identity || identity.status !== "active") {
        await deps.store.revertToApproved(ctx.id);
        return "parked";
      }
      let messageRef: string | null = null;
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
        await deps.store.setLeadInvited(ctx.leadId, now);
        messageRef = r.id;
      }
      await deps.store.markSent(ctx.id);
      await deps.store.recordOutreachSend({
        accountId: ctx.accountId, campaignId: ctx.campaignId, leadId: ctx.leadId,
        scheduledSendId: ctx.id, channel: "linkedin", linkedinAccountId: identity.id, messageRef,
      });
    }
    await deps.store.setCampaignLeadStatus(ctx.campaignId, ctx.leadId, "sent");
    return "sent";
  } catch (err) {
    await deps.store.markFailed(ctx.id, err instanceof Error ? err.message : String(err));
    return "failed";
  }
}

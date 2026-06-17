import type { AdInboundDeps, AdInboundEvent, AdInboundSummary } from "./types";

/**
 * Ad-lead ingestion (Phase 11). A lead submitted through an ad lead-form arrives here (via the
 * verified ads webhook). It resolves the ad campaign by its attribution ref, checks suppression
 * (rule 11 — even an opted-in lead is never contacted if they're on the suppression list), records
 * the lead as source 'ad', and enrolls it into the SAME nurture engine (sequence orchestrator) as
 * everything else by linking it to the campaign and marking it in_campaign. Pure, deps injected.
 */
export async function runAdInbound(
  event: AdInboundEvent,
  deps: AdInboundDeps
): Promise<AdInboundSummary> {
  const { store } = deps;
  const email = event.email?.trim().toLowerCase();
  if (!email || !event.campaignRef) return { outcome: "skipped" };

  const campaign = await store.getAdCampaignByRef(event.campaignRef);
  if (!campaign) return { outcome: "skipped" };

  if (await store.isSuppressed(campaign.accountId, "email", email)) {
    return { outcome: "suppressed" };
  }

  const leadId = await store.upsertAdLead({
    accountId: campaign.accountId,
    email,
    firstName: event.firstName,
    companyName: event.companyName,
  });

  // Opted-in ad leads flow straight into nurture — the sequence orchestrator enrols in_campaign
  // leads on its next tick. Without a nurture campaign yet, we still record the lead.
  if (campaign.campaignId) {
    await store.ensureCampaignLead(campaign.campaignId, leadId, campaign.accountId);
    await store.setLeadInCampaign(leadId);
  }

  return { outcome: "enrolled", leadId };
}

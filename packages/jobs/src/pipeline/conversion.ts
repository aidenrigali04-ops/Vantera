import type { ConversionDeps, ConversionResult } from "./types";

/**
 * v1 conversion trigger: a tracked CTA link resolves to a verified conversion.
 * Closes the run and cancels remaining touches so no further stage fires.
 */
export async function markConverted(token: string, deps: ConversionDeps): Promise<ConversionResult> {
  const target = await deps.store.resolveConversionToken(token);
  if (!target) return { converted: false, redirectUrl: null };

  await deps.store.setLeadConverted(target.leadId);
  await deps.store.closeSequenceRun(target.campaignId, target.leadId);
  await deps.store.cancelPendingSends(target.leadId);
  await deps.store.setCampaignLeadStatus(target.campaignId, target.leadId, "completed");
  await deps.store.insertLeadNotification({
    accountId: target.accountId, leadId: target.leadId, kind: "converted",
    body: "A lead completed your call-to-action.",
  });
  return { converted: true, redirectUrl: target.targetUrl };
}

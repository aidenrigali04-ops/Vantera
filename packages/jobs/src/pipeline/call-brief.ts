import { describeViolations } from "@vantera/agent-brains";
import type { CallBriefRequest, DraftInput } from "@vantera/agent-brains";
import type { CallableLead, CallBriefDeps, CallBriefDraftPayload, CallBriefSummary, CallerContext } from "./types";

/** E.164 suppression value: trim, strip spaces, lowercase (digits/+ unaffected; rule 11 value=lower(value)). */
export function normalizePhone(phone: string): string {
  return phone.replace(/\s+/g, "").trim().toLowerCase();
}

function toRequest(lead: CallableLead, ctx: CallerContext): CallBriefRequest | null {
  if (!lead.aiInsights) return null;
  const input: DraftInput = {
    lead: { firstName: lead.firstName, lastName: lead.lastName, title: lead.title, companyName: lead.companyName, industry: lead.industry },
    insights: lead.aiInsights,
    context: {
      cta: ctx.agent.config.cta,
      contentLinks: ctx.assets.map((a) => a.url ?? a.filename).filter((v): v is string => Boolean(v)),
      accountName: ctx.account.name,
      accountIndustry: ctx.account.industry,
      valueProp: ctx.account.websiteScan?.summary ?? null,
      brandVoice: ctx.agent.config.brandVoice ?? null,
      guardrails: ctx.agent.config.guardrails ?? null,
    },
  };
  return {
    input,
    bookingLink: ctx.agent.config.bookingLink,
    recordingConsentMode: ctx.agent.config.recordingConsentMode,
    personaName: ctx.agent.config.voice.personaName,
  };
}

/**
 * Draft per-lead call briefs into the review queue (channel 'call', pending_review).
 * Suppression (phone) is checked BEFORE any brief is drafted (rule 11). Only leads
 * with a valid phone and AI insights are eligible.
 */
export async function runCallBrief(payload: CallBriefDraftPayload, deps: CallBriefDeps): Promise<CallBriefSummary> {
  const ctx = await deps.store.getCallerContext(payload.callerAgentId);
  if (!ctx || ctx.agent.status !== "live" || !ctx.agent.campaignId) {
    return { status: "skipped", drafted: 0, suppressed: 0, skipped: 0 };
  }
  const { accountId } = ctx.agent;
  const campaignId = ctx.agent.campaignId;
  const leads = await deps.store.getCallableLeads(accountId, payload.leadIds);

  let drafted = 0;
  let suppressed = 0;
  let skipped = 0;

  for (const lead of leads) {
    const req = toRequest(lead, ctx);
    if (!req || lead.phoneStatus !== "valid" || !lead.phone) {
      skipped += 1;
      continue;
    }
    if (await deps.store.isSuppressed(accountId, "phone", normalizePhone(lead.phone))) {
      await deps.store.ensureCampaignLead(campaignId, lead.id, accountId);
      await deps.store.setCampaignLeadStatus(campaignId, lead.id, "suppressed");
      suppressed += 1;
      continue;
    }
    const brief = await deps.draftBriefFn(req);
    await deps.store.ensureCampaignLead(campaignId, lead.id, accountId);
    await deps.store.insertScheduledSend({
      accountId, campaignId, leadId: lead.id, channel: "call",
      subject: null, body: brief.openingLine, status: "pending_review",
      linkedinStage: null,
      styleFlags: brief.violations.length > 0 ? describeViolations(brief.violations) : null,
      brief,
    });
    await deps.store.setCampaignLeadStatus(campaignId, lead.id, "queued");
    await deps.store.setLeadStatus(lead.id, "in_campaign");
    drafted += 1;
  }

  return { status: "completed", drafted, suppressed, skipped };
}

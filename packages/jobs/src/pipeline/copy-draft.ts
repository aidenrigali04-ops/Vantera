import { describeViolations } from "@vantera/agent-brains";
import type { DraftInput } from "@vantera/agent-brains";
import type {
  CopyDraftDeps,
  CopyDraftPayload,
  CopyDraftSummary,
  CopyContext,
  DraftableLead,
} from "./types";

/** linkedin suppression values are normalized profile URLs (rule 11: value = lower(value)) */
export function normalizeLinkedInUrl(url: string): string {
  return url.trim().toLowerCase().replace(/\/+$/, "");
}

function toDraftInput(lead: DraftableLead, ctx: CopyContext): DraftInput | null {
  if (!lead.aiInsights) return null;
  return {
    lead: {
      firstName: lead.firstName,
      lastName: lead.lastName,
      title: lead.title,
      companyName: lead.companyName,
      industry: lead.industry,
    },
    insights: lead.aiInsights,
    context: {
      cta: ctx.agent.config.cta,
      contentLinks: ctx.assets
        .map((a) => a.url ?? a.filename)
        .filter((v): v is string => Boolean(v)),
      accountIndustry: ctx.account.industry,
      valueProp: ctx.account.websiteScan?.summary ?? null,
    },
  };
}

/**
 * Draft personalized outreach for qualified leads into the review queue.
 * The suppression check runs BEFORE any draft on every channel (rule 11), and
 * nothing here moves past 'pending_review' — live sending is Phase 5.
 */
export async function runCopyDraft(
  payload: CopyDraftPayload,
  deps: CopyDraftDeps
): Promise<CopyDraftSummary> {
  const ctx = await deps.store.getCopyContext(payload.copyAgentId);
  if (!ctx || ctx.agent.status !== "live" || !ctx.agent.campaignId) {
    return { status: "skipped", drafted: 0, suppressed: 0, skipped: 0 };
  }
  const { campaignId } = ctx.agent;
  const { accountId } = ctx.agent;
  const channels = ctx.agent.config.channels;

  const leads = await deps.store.getDraftableLeads(accountId, payload.leadIds);
  let drafted = 0;
  let suppressed = 0;
  let skipped = 0;

  for (const lead of leads) {
    const input = toDraftInput(lead, ctx);
    if (!input) {
      skipped += 1;
      continue;
    }
    await deps.store.ensureCampaignLead(campaignId, lead.id, accountId);

    let leadDrafted = 0;
    let leadSuppressed = 0;

    if (channels.email && lead.email) {
      if (await deps.store.isSuppressed(accountId, "email", lead.email.toLowerCase())) {
        leadSuppressed += 1;
      } else {
        const draft = await deps.draftEmailFn(input);
        await deps.store.insertScheduledSend({
          accountId,
          campaignId,
          leadId: lead.id,
          channel: "email",
          subject: draft.subject,
          body: draft.body,
          status: "pending_review",
          styleFlags: draft.violations.length > 0 ? describeViolations(draft.violations) : null,
        });
        leadDrafted += 1;
      }
    }

    if (channels.linkedin && lead.linkedinUrl) {
      if (
        await deps.store.isSuppressed(accountId, "linkedin", normalizeLinkedInUrl(lead.linkedinUrl))
      ) {
        leadSuppressed += 1;
      } else {
        const draft = await deps.draftLinkedInFn(input);
        // first touch only: the connection note. The follow-up is generated again at
        // Phase 5 when acceptance events exist to hang it off.
        await deps.store.insertScheduledSend({
          accountId,
          campaignId,
          leadId: lead.id,
          channel: "linkedin",
          subject: null,
          body: draft.connectionNote,
          status: "pending_review",
          styleFlags: draft.violations.length > 0 ? describeViolations(draft.violations) : null,
        });
        leadDrafted += 1;
      }
    }

    if (leadDrafted > 0) {
      await deps.store.setCampaignLeadStatus(campaignId, lead.id, "queued");
      await deps.store.setLeadStatus(lead.id, "in_campaign");
      drafted += leadDrafted;
      suppressed += leadSuppressed;
    } else if (leadSuppressed > 0) {
      await deps.store.setCampaignLeadStatus(campaignId, lead.id, "suppressed");
      suppressed += leadSuppressed;
    } else {
      await deps.store.setCampaignLeadStatus(campaignId, lead.id, "skipped");
      skipped += 1;
    }
  }

  return { status: "completed", drafted, suppressed, skipped };
}

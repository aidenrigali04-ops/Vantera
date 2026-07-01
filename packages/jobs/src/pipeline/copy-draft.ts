import { describeViolations, assignVariant } from "@vantera/agent-brains";
import type { DraftInput, CopyStrategy } from "@vantera/agent-brains";
import type {
  CopyDraftDeps,
  CopyDraftPayload,
  CopyDraftSummary,
  CopyContext,
  DraftableLead,
} from "./types";
import { mapWithConcurrency } from "./concurrency";

/** In-flight LLM drafts per copy-draft run — bounds model + DB-pool pressure while parallelizing. */
const DRAFT_CONCURRENCY = 4;

/** linkedin suppression values are normalized profile URLs (rule 11: value = lower(value)) */
export function normalizeLinkedInUrl(url: string): string {
  return url.trim().toLowerCase().replace(/\/+$/, "");
}

function toDraftInput(lead: DraftableLead, ctx: CopyContext, strategy?: CopyStrategy): DraftInput | null {
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
      // Empty / absent → strategyDirectives("") → prompt unchanged from before the optimizer.
      strategy,
    },
  };
}

/**
 * Resolve the draft status for a send row.
 * automatic mode promotes clean drafts to 'approved'; any style violations
 * always fall back to 'pending_review' regardless of mode (the guardrail:
 * flagged copy never auto-sends).
 */
function draftStatus(
  sendMode: "review" | "automatic",
  violations: unknown[]
): "pending_review" | "approved" {
  return sendMode === "automatic" && violations.length === 0 ? "approved" : "pending_review";
}

/**
 * Draft personalized outreach for qualified leads into the review queue.
 * The suppression check runs BEFORE any draft on every channel (rule 11).
 * automatic send mode promotes clean drafts to 'approved'; style-flagged
 * drafts always stay 'pending_review'. LinkedIn leads get an invite+message
 * pair stored as two rows.
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

  // Self-optimizing loop (Phase 3): resolve the account's running experiment + adopted champion
  // strategy once. Inert by default — no experiment + an empty playbook means every lead resolves to
  // {} (no strategy directives), so drafting is identical to before the optimizer existed.
  const experiment = await deps.store.getActiveExperiment(accountId);
  const champion = await deps.store.getChampionStrategy(accountId);

  const leads = await deps.store.getDraftableLeads(accountId, payload.leadIds);
  // Idempotency: a retried run (Trigger maxAttempts) must never re-draft a lead that already
  // has rows — that would duplicate the invite/message pair and waste an LLM call.
  const alreadyDrafted = await deps.store.leadsWithExistingSends(accountId, payload.leadIds);

  type Outcome = { drafted: number; suppressed: number; skipped: number };
  const ZERO: Outcome = { drafted: 0, suppressed: 0, skipped: 0 };

  // Bounded concurrency: the per-lead LLM draft + writes used to run one lead at a time, so
  // wall-clock was N x draft latency. Drafting is the gate between "qualified" and "sendable",
  // so its throughput is the account's outreach volume. DRAFT_CONCURRENCY caps in-flight drafts.
  const outcomes = await mapWithConcurrency(leads, DRAFT_CONCURRENCY, async (lead): Promise<Outcome> => {
    if (alreadyDrafted.has(lead.id)) return ZERO;
    // Deterministic, sticky per-lead arm assignment; strategy is the challenger's or the champion.
    const variant = experiment ? assignVariant(experiment, lead.id) : null;
    const strategy = variant === "challenger" ? experiment!.challengerStrategy : champion;
    const input = toDraftInput(lead, ctx, strategy);
    if (!input) return { drafted: 0, suppressed: 0, skipped: 1 };
    await deps.store.ensureCampaignLead(campaignId, lead.id, accountId);

    let leadDrafted = 0;
    let leadSuppressed = 0;

    if (channels.linkedin && lead.linkedinUrl) {
      if (
        await deps.store.isSuppressed(accountId, "linkedin", normalizeLinkedInUrl(lead.linkedinUrl))
      ) {
        leadSuppressed += 1;
      } else {
        // suppression checked above; one draft call yields both the invite note and follow-up
        const draft = await deps.draftLinkedInFn(input);
        const status = draftStatus(ctx.agent.sendMode, draft.violations);
        const flags = draft.violations.length > 0 ? describeViolations(draft.violations) : null;
        const common = {
          accountId,
          campaignId,
          leadId: lead.id,
          channel: "linkedin" as const,
          subject: null,
          status,
          styleFlags: flags,
        };
        await deps.store.insertLinkedInSendPair(
          { ...common, linkedinStage: "invite", body: draft.connectionNote },
          { ...common, linkedinStage: "message", body: draft.followupMessage }
        );
        leadDrafted += 1;
      }
    }

    if (leadDrafted > 0) {
      await deps.store.setCampaignLeadStatus(campaignId, lead.id, "queued");
      await deps.store.setLeadStatus(lead.id, "in_campaign");
      // Attribute this lead's whole sequence to its arm so later outcomes measure the experiment.
      if (experiment && variant) await deps.store.stampLeadExperiment(lead.id, experiment.id, variant);
      return { drafted: leadDrafted, suppressed: leadSuppressed, skipped: 0 };
    } else if (leadSuppressed > 0) {
      await deps.store.setCampaignLeadStatus(campaignId, lead.id, "suppressed");
      return { drafted: 0, suppressed: leadSuppressed, skipped: 0 };
    } else {
      await deps.store.setCampaignLeadStatus(campaignId, lead.id, "skipped");
      return { drafted: 0, suppressed: 0, skipped: 1 };
    }
  });

  const drafted = outcomes.reduce((s, o) => s + o.drafted, 0);
  const suppressed = outcomes.reduce((s, o) => s + o.suppressed, 0);
  const skipped = outcomes.reduce((s, o) => s + o.skipped, 0);

  return { status: "completed", drafted, suppressed, skipped };
}

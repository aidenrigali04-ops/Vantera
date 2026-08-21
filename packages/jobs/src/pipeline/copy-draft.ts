import { describeViolations, assignVariant, buildSendRecipe, LINKEDIN_SYSTEM, bestOfN, leadBlock, selectMessageShape, deriveAccountProfile } from "@vantera/agent-brains";
import type { DraftInput, CopyStrategy } from "@vantera/agent-brains";
import { getModelId } from "@vantera/ai";
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

/**
 * Best-of-N budget ceiling (Task 3) — code-enforced regardless of what the `best_of_n`
 * app-setting says, so a config typo can't blow up per-lead LLM spend.
 */
export const MAX_BEST_OF_N = 5;

/** linkedin suppression values are normalized profile URLs (rule 11: value = lower(value)) */
export function normalizeLinkedInUrl(url: string): string {
  return url.trim().toLowerCase().replace(/\/+$/, "");
}

function toDraftInput(lead: DraftableLead, ctx: CopyContext, strategy?: CopyStrategy): DraftInput | null {
  if (!lead.aiInsights) return null;
  // Vera's positive memory (Stage 0.5): a winning opener must never also sit in the avoid list —
  // "use as a guide" + "do not reuse" on the same string is a contradictory prompt. Exemplars win.
  const winners = ctx.winningOpeners ?? [];
  const winnerSet = new Set(winners.map((w) => w.trim().toLowerCase()));
  const avoidPhrases = ctx.avoidPhrases.filter((p) => !winnerSet.has(p.trim().toLowerCase()));
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
      // no bookingUrl here on purpose: the first touch is link-free by rule; the link
      // belongs to the conversation stage (responder bundle), where interest exists
      contentLinks: ctx.assets
        .map((a) => a.url ?? a.filename)
        .filter((v): v is string => Boolean(v)),
      accountIndustry: ctx.account.industry,
      // 0061: seller-authored positioning wins; the website-scan summary is the fallback. Voice +
      // guardrails apply everywhere (leadBlock renders them); the opener stays de-pitched via the
      // first-touch prompt rules, so the value-prop substance still doesn't leak into message one.
      valueProp: ctx.account.valueProp ?? ctx.account.websiteScan?.summary ?? null,
      brandVoice: ctx.account.brandVoice ?? null,
      guardrails: ctx.account.guardrails ?? null,
      avoidPhrases,
      winningExemplars: winners,
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
  const champion = await deps.store.getChampion(accountId);

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
    let strategy = variant === "challenger" ? experiment!.challengerStrategy : champion.strategy;
    // Message-shape selector (spec 2026-07-20) — CONFIG-GATED champion default. When the global
    // `message_shape_auto` app-setting is OFF (default), this whole block is skipped and the
    // champion behaves EXACTLY as before (byte-identical). When ON, the champion's opener structure
    // becomes the signal-justified SAFE shape for this lead. Applied ONLY on the champion arm (never
    // a challenger's chosen shape) and ONLY when the champion doesn't already pin a shape. A thin
    // signal resolves to observation_question, which we deliberately do NOT stamp — leaving strategy
    // untouched keeps the recipe/signature byte-identical to the no-shape champion (the safe floor
    // is a no-op, preserving the optimizer's null hypothesis). Never mutates the shared champion
    // object (a fresh object is spread).
    if (
      deps.messageShapeAuto &&
      variant !== "challenger" &&
      !strategy.messageShape &&
      lead.aiInsights
    ) {
      // Config-aware approach selection (spec 2026-07-21): the account's derived PROFILE sets the
      // approach prior for the champion default. Assembled here in the JOBS layer from the FULL ctx
      // (cta, booking/website url presence, industry, website-scan valueProp, assets, proof count) —
      // NEVER from message text — and passed into the PURE brain selector. The profile biases
      // APPROACH only; facts still come from grounding and every anti-hallucination layer stays in
      // force. This whole block only runs when message_shape_auto is ON, so the OFF path derives no
      // profile and the champion prompt/recipe stay byte-identical.
      const profile = deriveAccountProfile({
        cta: ctx.agent.config.cta,
        hasBookingUrl: Boolean(ctx.agent.config.bookingUrl),
        hasWebsiteUrl: Boolean(ctx.agent.config.websiteUrl),
        industry: ctx.account.industry,
        valueProp: ctx.account.valueProp ?? ctx.account.websiteScan?.summary ?? null,
        hasArtifact: (ctx.assets ?? []).some((a) => Boolean((a.url ?? a.filename)?.trim())),
        proofCount: ctx.proofCount ?? 0,
      });
      const shape = selectMessageShape(lead.aiInsights, profile);
      if (shape !== "observation_question") strategy = { ...strategy, messageShape: shape };
    }
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
        // suppression checked above; one draft call yields both the invite note and follow-up.
        // Best-of-N (Task 3, quality lever 2): absent judgeFn forces n=1 regardless of config —
        // no point drafting N candidates with nothing to rank them. n<=1 is byte-identical to
        // today (draftLinkedInFn runs exactly once, the judge never runs), which is how the
        // feature stays fully OFF by default. The winner — chosen or not — flows through the
        // UNCHANGED humanizer/fixLinkedInFn gate below; the judge only ranks among candidates,
        // it never bypasses that gate (anti-Goodhart: the humanizer stays the hard floor).
        const configuredN = Math.min(Math.max(1, Math.floor(deps.bestOfN ?? 1)), MAX_BEST_OF_N);
        const n = deps.judgeFn ? configuredN : 1;
        const { chosen } = await bestOfN(
          n,
          () => deps.draftLinkedInFn(input),
          (d) => d.followupMessage,
          { grounding: leadBlock(input), cta: input.context.cta },
          deps.judgeFn
        );
        let draft = chosen;
        // Automatic senders get ONE targeted fix of a flagged pair before it may auto-approve; the
        // fix is re-linted with the same validator, so a still-flagged pair waits in review.
        if (ctx.agent.sendMode === "automatic" && draft.violations.length > 0 && deps.fixLinkedInFn) {
          draft = await deps.fixLinkedInFn(draft, input);
        }
        const status = draftStatus(ctx.agent.sendMode, draft.violations);
        const flags = draft.violations.length > 0 ? describeViolations(draft.violations) : null;
        // Stage 1: stamp the pair with the recipe that produced it — outcomes join back to this.
        const recipe = buildSendRecipe({
          brain: "first_touch",
          strategy,
          experimentId: experiment?.id ?? null,
          variant,
          playbookVersion: champion.version,
          exemplars: (ctx.winningOpeners ?? []).length,
          // WS-3.4: the EXACT registry hash/model id that drafted this pair, threaded from the
          // brain's own prompt handle — never re-registered, so the hash can never drift.
          promptHash: LINKEDIN_SYSTEM.hash,
          modelId: getModelId(),
          // Task 3: only stamped when best-of-N actually ran (n>1) — n<=1 keeps the exact
          // pre-Task-3 recipe shape (see buildSendRecipe's bestOfN doc), so every existing
          // recipe-equality test and every off-by-default run stays byte-identical.
          ...(n > 1 ? { bestOfN: n } : {}),
        });
        const common = {
          accountId,
          campaignId,
          leadId: lead.id,
          channel: "linkedin" as const,
          subject: null,
          status,
          styleFlags: flags,
          recipe,
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

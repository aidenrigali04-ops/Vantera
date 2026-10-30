import {
  describeViolations,
  buildSendRecipe,
  LINKEDIN_SYSTEM,
  LINKEDIN_NOTE_SYSTEM,
  LINKEDIN_PAIR_MESSAGE_TYPE,
  bestOfN,
  leadBlock,
  leadIdentity,
  linkedinJudgeText,
  selectMessageShape,
  deriveAccountProfile,
  findRepeatedOpener,
  openerSkeleton,
  openerSkeletons,
} from "@vantera/agent-brains";
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

/** What the best-of-N judge is told it is reading in note-only mode. */
const NOTE_MESSAGE_TYPE =
  "LinkedIn connection note: the only message before the request is accepted; no pitch, no CTA, no links";

/** Hard ceiling on first-touch invite drafts per account per UTC day. */
export const DAILY_FIRST_TOUCH_DRAFT_CAP = 15;

export function utcDayStart(now: Date): Date {
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
}

/** A lead holds a first-touch slot only when this run will insert an invite. */
async function holdsFirstTouchSlot(
  lead: DraftableLead,
  ctx: CopyContext,
  channels: CopyContext["agent"]["config"]["channels"],
  accountId: string,
  store: CopyDraftDeps["store"]
): Promise<boolean> {
  if (!toDraftInput(lead, ctx)) return false;
  if (!channels.linkedin || !lead.linkedinUrl) return false;
  const suppressed = await store.isSuppressed(
    accountId,
    "linkedin",
    normalizeLinkedInUrl(lead.linkedinUrl)
  );
  return !suppressed;
}

/** linkedin suppression values are normalized profile URLs (rule 11: value = lower(value)) */
export function normalizeLinkedInUrl(url: string): string {
  return url.trim().toLowerCase().replace(/\/+$/, "");
}

function toDraftInput(
  lead: DraftableLead,
  ctx: CopyContext,
  strategy?: CopyStrategy,
  avoidSkeletons?: string[]
): DraftInput | null {
  if (!lead.aiInsights) return null;
  // Vera's positive memory (Stage 0.5): a winning opener must never also sit in the PROMPT's avoid
  // list — "reuse the angle" + "do not reuse" on the same string is a contradictory prompt. But the
  // exemplars DO stay in the code-enforced skeleton check (avoidSkeletons): reusing a winner's
  // angle is the point, cloning its first words is the template problem (copy-quality fix).
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
      whyNow: lead.whyNow ?? null,
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
      // Code-only (never prompt/grounding): enforced by the repeated-opener lint.
      ...(avoidSkeletons && avoidSkeletons.length > 0 ? { avoidSkeletons } : {}),
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
    return { status: "skipped", drafted: 0, suppressed: 0, skipped: 0, deferred: 0 };
  }
  const { campaignId } = ctx.agent;
  const { accountId } = ctx.agent;
  const channels = ctx.agent.config.channels;

  // The account's playbook champion strategy, resolved once. An empty playbook resolves every lead
  // to {} (no strategy directives).
  const champion = await deps.store.getChampion(accountId);

  const leads = await deps.store.getDraftableLeads(accountId, payload.leadIds);
  // Idempotency: a retried run (Trigger maxAttempts) must never re-draft a lead that already
  // has rows — that would duplicate the invite/message pair and waste an LLM call.
  const alreadyDrafted = await deps.store.leadsWithExistingSends(accountId, payload.leadIds);
  const fresh = leads.filter((lead) => !alreadyDrafted.has(lead.id));
  const used = await deps.store.countFirstTouchDraftsSince(accountId, utcDayStart(new Date()));
  let slots = Math.max(0, DAILY_FIRST_TOUCH_DRAFT_CAP - used);
  // Same order the drain used (getTopQualifiedLeadIds): the ML-1 learner's predicted reply rate
  // when it has evidence, else stored score + the bounded tilt — so the last daily slots go to the
  // buyers most like those who actually replied. The payload order itself isn't trusted (intent
  // sends unsorted). Ordering ONLY — never a gate.
  const order = await deps.store.rankLeadIds(accountId, fresh.map((lead) => lead.id));
  const position = new Map(order.map((id, i) => [id, i]));
  const ranked = [...fresh].sort((a, b) => (position.get(a.id) ?? Infinity) - (position.get(b.id) ?? Infinity));
  const room: DraftableLead[] = [];
  let deferred = 0;
  for (const lead of ranked) {
    if (!(await holdsFirstTouchSlot(lead, ctx, channels, accountId, deps.store))) {
      room.push(lead);
      continue;
    }
    if (slots <= 0) {
      deferred += 1;
      continue;
    }
    slots -= 1;
    room.push(lead);
  }

  type Outcome = { drafted: number; suppressed: number; skipped: number };

  // Opener skeletons (copy-quality fix): recent sends (sent + queued, identity already stripped by
  // the store) and the winning exemplars, plus every follow-up drafted EARLIER IN THIS RUN — the
  // drafts run concurrently, so without the in-run list a batch could converge on one template.
  const baseSkeletons = openerSkeletons([...ctx.avoidPhrases, ...(ctx.winningOpeners ?? [])]);
  const runSkeletons: string[] = [];

  /**
   * Note-only first touch (conversation mode on): best-of-N over the note text, the in-run skeleton
   * collision check on the NOTE, then ONE invite row. The note brain lints itself (validateLinkedInNote
   * inside draftLinkedInNote); there is no note fixer, so an automatic sender's flagged note waits in
   * review. Caller has already passed the rule-11 suppression check.
   */
  const draftNoteOnly = async (input: DraftInput, strategy: CopyStrategy, leadId: string): Promise<void> => {
    const configuredN = Math.min(Math.max(1, Math.floor(deps.bestOfN ?? 1)), MAX_BEST_OF_N);
    const n = deps.judgeFn ? configuredN : 1;
    const { chosen } = await bestOfN(
      n,
      () => deps.draftLinkedInNoteFn(input),
      (d) => d.connectionNote,
      { grounding: leadBlock(input), cta: input.context.cta, messageType: NOTE_MESSAGE_TYPE },
      deps.judgeFn
    );
    let note = chosen;
    // same synchronous check-then-push as the pair path: concurrent drafts can't both slip through
    const identity = leadIdentity(input.lead);
    if (!note.violations.some((v) => v.rule === "repeated-opener")) {
      const repeat = findRepeatedOpener(note.connectionNote, runSkeletons, identity);
      if (repeat.length > 0) note = { ...note, violations: [...note.violations, ...repeat] };
    }
    const mine = openerSkeleton(note.connectionNote, identity);
    if (mine) runSkeletons.push(mine);
    await deps.store.insertScheduledSend({
      accountId,
      campaignId,
      leadId,
      channel: "linkedin",
      subject: null,
      body: note.connectionNote,
      status: draftStatus(ctx.agent.sendMode, note.violations),
      linkedinStage: "invite",
      styleFlags: note.violations.length > 0 ? describeViolations(note.violations) : null,
      recipe: buildSendRecipe({
        brain: "first_touch",
        strategy,
        playbookVersion: champion.version,
        exemplars: (ctx.winningOpeners ?? []).length,
        promptHash: LINKEDIN_NOTE_SYSTEM.hash,
        modelId: getModelId(),
        ...(n > 1 ? { bestOfN: n } : {}),
      }),
    });
  };

  // Bounded concurrency: the per-lead LLM draft + writes used to run one lead at a time, so
  // wall-clock was N x draft latency. Drafting is the gate between "qualified" and "sendable",
  // so its throughput is the account's outreach volume. DRAFT_CONCURRENCY caps in-flight drafts.
  const outcomes = await mapWithConcurrency(room, DRAFT_CONCURRENCY, async (lead): Promise<Outcome> => {
    let strategy = champion.strategy;
    // Message-shape selector (spec 2026-07-20) — CONFIG-GATED champion default. When the global
    // `message_shape_auto` app-setting is OFF (default), this whole block is skipped and the
    // champion behaves EXACTLY as before (byte-identical). When ON, the champion's opener structure
    // becomes the signal-justified SAFE shape for this lead. Applied ONLY when the champion doesn't
    // already pin a shape. A thin signal resolves to observation_question, which we deliberately do
    // NOT stamp — leaving strategy untouched keeps the recipe/signature byte-identical to the
    // no-shape champion (the safe floor is a no-op). Never mutates the shared champion object (a
    // fresh object is spread).
    if (
      deps.messageShapeAuto &&
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
    const input = toDraftInput(lead, ctx, strategy, [...baseSkeletons, ...runSkeletons]);
    if (!input) return { drafted: 0, suppressed: 0, skipped: 1 };
    await deps.store.ensureCampaignLead(campaignId, lead.id, accountId);

    let leadDrafted = 0;
    let leadSuppressed = 0;

    if (channels.linkedin && lead.linkedinUrl) {
      if (
        await deps.store.isSuppressed(accountId, "linkedin", normalizeLinkedInUrl(lead.linkedinUrl))
      ) {
        leadSuppressed += 1;
      } else if (deps.conversationMode === "live") {
        // Spec §7.2: under "live" the conversation core writes the first message at acceptance
        // (first-message scan), from the live thread — so the first touch here is the note ONLY.
        // shadow / live_replies keep the pair: the legacy follow-up is what actually gets sent there
        // (the scan only logs a shadow decision against it), so a connected lead is never left silent.
        await draftNoteOnly(input, strategy, lead.id);
        leadDrafted += 1;
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
          // the judge reads the pair as the prospect will (note, then follow-up) so it can score
          // whether the follow-up builds on the note — not the follow-up in isolation
          linkedinJudgeText,
          { grounding: leadBlock(input), cta: input.context.cta, messageType: LINKEDIN_PAIR_MESSAGE_TYPE },
          deps.judgeFn
        );
        let draft = chosen;
        // In-run collision: a draft that finished while this one was in flight may share its first
        // words. Checked synchronously against the live list (no await between check and push), so
        // two concurrent drafts can't both slip through; a collision routes to review / the fix pass.
        const identity = leadIdentity(input.lead);
        if (!draft.violations.some((v) => v.rule === "repeated-opener")) {
          const repeat = findRepeatedOpener(draft.followupMessage, runSkeletons, identity);
          if (repeat.length > 0) draft = { ...draft, violations: [...draft.violations, ...repeat] };
        }
        const mine = openerSkeleton(draft.followupMessage, identity);
        if (mine) runSkeletons.push(mine);
        // Automatic senders get ONE targeted fix of a flagged pair before it may auto-approve; the
        // fix is re-linted with the same validator, so a still-flagged pair waits in review.
        if (ctx.agent.sendMode === "automatic" && draft.violations.length > 0 && deps.fixLinkedInFn) {
          // the fix re-lints against EVERY skeleton known now (other in-run drafts included)
          const fixInput: DraftInput = {
            ...input,
            context: {
              ...input.context,
              avoidSkeletons: [...baseSkeletons, ...runSkeletons.filter((sk) => sk !== mine)],
            },
          };
          draft = await deps.fixLinkedInFn(draft, fixInput);
          const fixed = openerSkeleton(draft.followupMessage, identity);
          if (fixed && fixed !== mine) runSkeletons.push(fixed);
        }
        const status = draftStatus(ctx.agent.sendMode, draft.violations);
        const flags = draft.violations.length > 0 ? describeViolations(draft.violations) : null;
        // Stage 1: stamp the pair with the recipe that produced it — outcomes join back to this.
        const recipe = buildSendRecipe({
          brain: "first_touch",
          strategy,
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

  return { status: "completed", drafted, suppressed, skipped, deferred };
}

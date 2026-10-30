import type {
  CompanySignalSource,
  EnrichedProspect,
  IcpCriteria,
  ProspectCandidate,
  ProspectDataSource,
} from "@vantera/prospect-data";
import type {
  DeriveCriteriaContext,
  IntentContext,
  IntentObservationInput,
  IntentVerdict,
  LeadInsights,
  LinkedInDraft,
  LinkedInNoteDraft,
  DraftInput,
  RankCandidate,
  RankContext,
  WhyNow,
  LearnedReadout,
  ReplyVerdict,
  RulesGateResult,
  StoredInsights,
  WebsiteScan,
  CopyLead,
  CopyContext as BrainCopyContext,
  ConversationDraft,
  ConversationMessageInput,
  ConversationTurn,
  CopyStrategy,
  FunnelCohort,
  LeadOutcomeFlags,
  StampArm,
  StrategyGenome,
  StrategySource,
  SendRecipe,
  JudgeFn,
  ConversationState,
  StoredTurn,
  PriorTable,
  Readout,
  Move,
  Phase,
  Archetype,
  Veto,
  Trigger,
  DecisionOutcome,
} from "@vantera/agent-brains";
import type { OutreachCapacity } from "./capacity";
import type { SenderCandidate } from "./sender-assignment";
import type { ConversationDecideDeps } from "./conversation-decide";
import type { LinkedInInfra } from "@vantera/linkedin-infra";

export interface ScoutConfig {
  prospectsPerRun: number;
  minScore: number;
  /** capacity-throttle tunables (per-agent override via agents.config jsonb) */
  bufferFactor: number;
  floor: number;
  /** ML-5: the user's exclusions + guidance, raw jsonb (normalizeTargetingRules) */
  targeting?: unknown;
}

// Apify-era volume (2026-06-22): LinkedIn-search discovery is cheap to pull wide, so we source a
// larger pool ahead of send capacity and let the quality gate select the best — a bigger, fresher
// top-of-funnel without changing the account-safe send pace. computeRunTarget still clamps to
// capacity + backlog, so this raises the influx without ever sourcing past what can be worked.
// (Per-agent overridable via agents.config.)
export const SCOUT_DEFAULTS: ScoutConfig = {
  prospectsPerRun: 60,
  minScore: 70,
  bufferFactor: 2.0,
  floor: 5,
};

/**
 * Trial COGS cap: a trialing account sources at most this many leads total, so
 * enrichment spend (rule 05, on rules-gate survivors) is bounded until it converts.
 * Pairs with the free-trial policy in @vantera/billing (TRIAL_TIER/TRIAL_DAYS); this
 * is the prospecting-budget half and lives with the scout pipeline that enforces it.
 */
export const TRIAL_LEAD_CAP = 100;

/**
 * Worst-case prospect-data credits one discovered prospect can cost across the full waterfall:
 * 1 (discovery) + 5 (contacts: email+phone) + 1 (firmographics) + 2 (events) = 9. MEASURED live
 * 2026-06-18 (see project-explorium-enrichment). The credit pool is platform-wide (one provider
 * account serves every tenant), so the Scout multiplies this by a run's target to confirm the pool
 * can fully cover the run BEFORE spending — turning a mid-run insufficient-credit hard-stop into a
 * clean, observable skip. Worst case assumes every discovered prospect survives the gate; real runs
 * cost less, so this is a deliberately conservative floor.
 */
export const WORST_CASE_CREDITS_PER_PROSPECT = 9;

/**
 * Trial send cap: a trialing account dispatches at most this many outbound LinkedIn
 * sends total. Bounds per-send COGS and LinkedIn-account exposure until the account
 * converts. Enforced per-account at the send-dispatch boundary, alongside the LinkedIn
 * safety limits.
 */
export const TRIAL_SEND_CAP = 50;

export interface ScoutContext {
  agent: {
    id: string;
    accountId: string;
    status: string;
    cadence: "daily" | "weekly" | null;
    config: Partial<ScoutConfig>;
  };
  icps: { id: string; name: string; criteria: IcpCriteria }[];
  account: {
    industry: string | null;
    websiteUrl: string | null;
    websiteScan: (WebsiteScan & { url?: string }) | null;
    websiteScannedAt: Date | null;
    /** Drives the trial lead cap; 'trialing' accounts are bounded by TRIAL_LEAD_CAP. */
    subscriptionStatus: string;
    /**
     * Trial expiry already skips this workspace, so the row can stay `trialing` forever.
     * When set, lead and send caps treat it as paid. Otherwise sourcing stops at
     * TRIAL_LEAD_CAP and later runs look like a search that found nothing.
     */
    trialCapsExempt?: boolean;
    /** features.intent (Growth/Scale) — gates the company-event signal fetch (Phase 15). */
    intentEnabled: boolean;
  };
}

export interface FreshLead {
  leadId: string;
  icpId: string;
  candidate: ProspectCandidate;
}

export interface ScoutStore {
  getScoutContext(agentId: string): Promise<ScoutContext | null>;
  /** Total leads already sourced for the account — used to enforce TRIAL_LEAD_CAP. */
  countAccountLeads(accountId: string): Promise<number>;
  saveWebsiteScan(accountId: string, url: string, scan: WebsiteScan): Promise<void>;
  /** insert unseen candidates, return new-or-unscored leads only (dedupe by external_ref per account) */
  upsertLeads(accountId: string, icpId: string, candidates: ProspectCandidate[]): Promise<FreshLead[]>;
  /** persist criteria derived from an ICP's free text (self-heal — derived once, reused forever) */
  saveIcpCriteria(icpId: string, criteria: IcpCriteria): Promise<void>;
  markRulesGate(leadId: string, result: RulesGateResult): Promise<void>;
  saveEnrichment(leadId: string, accountId: string, enriched: EnrichedProspect): Promise<void>;
  saveScore(leadId: string, insights: LeadInsights, qualified: boolean): Promise<void>;
  /** Anticipation hook: drop a "hot signal" notification for qualified leads carrying a fresh,
   *  high-value buying signal (funding/intent/exec-hire/M&A). Best-effort; never blocks the run. */
  notifyHotSignals(accountId: string, items: { leadId: string; label: string }[]): Promise<void>;
  completeRun(agentId: string, lastRunAt: Date): Promise<void>;
  /** live outreach capacity for the account (LinkedIn connection state) */
  getOutreachCapacity(accountId: string): Promise<OutreachCapacity>;
  /** in-flight leads not yet contacted (pending_review/approved/scheduled sends, no send recorded) */
  countUncontactedLeads(accountId: string): Promise<number>;
  /** size of the qualified, not-yet-drafted pool (status 'qualified') — gates discovery overscan */
  countQualifiedPool(accountId: string): Promise<number>;
  /** top-N qualified, not-yet-drafted lead ids — best-first draft draining (overscan). Stage 2:
   *  ordering = ai_score + the bounded outcome tilt (rankByTilt); ordering ONLY, never a gate. */
  getTopQualifiedLeadIds(accountId: string, limit: number): Promise<string[]>;
  getLiveCopyAgent(accountId: string): Promise<{ id: string } | null>;
  /** Stage 2: per-ICP outcome evidence (invited leads → flags) for the discovery allocator.
   *  Empty ⇒ the allocator falls back to the equal split. */
  getIcpOutcomeRows(accountId: string): Promise<{ icpId: string; flags: LeadOutcomeFlags }[]>;
  /** ML-1: the learner's readout for the run summary (top winning/losing features). */
  getLearnedInsights(accountId: string): Promise<LearnedInsights>;
  /** ML-7: qualified/contacted leads whose profile was never embedded or has changed (≤ limit) */
  getLeadsToEmbed(accountId: string, limit: number): Promise<{ leadId: string; text: string; sourceHash: string }[]>;
  saveLeadEmbeddings(accountId: string, rows: { leadId: string; embedding: number[]; model: string; sourceHash: string }[]): Promise<void>;
  /** ML-1 fit feedback: recent "title | company | industry" lines for leads the user rejected as the
   *  wrong person in review, and for leads that replied positively (≤ RANK_FEEDBACK_MAX each). */
  getRankFeedback(accountId: string): Promise<{ rejected: string[]; positive: string[] }>;
  /** Rank-miss retry: gate survivors created since `since` that were never scored (scored_at null,
   *  status 'sourced'), newest first, as rank inputs. Feeds Scout's retry stage. */
  getUnrankedLeads(accountId: string, since: Date, limit: number): Promise<RankCandidate[]>;
}

export interface ScoutDeps {
  store: ScoutStore;
  prospectData: ProspectDataSource;
  /** Company-event buying signals (Phase 15) — only used on Intent-entitled plans; omitted = no-op. */
  companySignals?: CompanySignalSource;
  scanFn: (url: string) => Promise<WebsiteScan>;
  rankFn: (candidates: RankCandidate[], ctx: RankContext) => Promise<LeadInsights[]>;
  /** ML-7: embed profile texts (absent = lookalikes off, e.g. no embeddings key configured) */
  embedFn?: { model: string; embed: (texts: string[]) => Promise<number[][]> };
  /** ICP free text → structured discovery criteria — heals ICPs saved with empty criteria,
   *  which otherwise search with an empty input and silently discover nothing */
  deriveCriteriaFn: (icpText: string, ctx: DeriveCriteriaContext) => Promise<IcpCriteria>;
  triggerCopyDraft: (payload: CopyDraftPayload) => Promise<void>;
  now?: () => Date;
  /** RNG for the Stage-2 discovery allocator (injectable for deterministic tests) */
  rand?: () => number;
}

/** T4: one row per scheduled agent run — recorded by the trigger wrappers (service role). */
export interface AgentRunRecord {
  accountId: string;
  agentId: string;
  kind: "scout" | "intent";
  status: "completed" | "skipped" | "failed";
  summary: Record<string, unknown>;
  note?: string | null;
}

export interface AgentRunStore {
  recordAgentRun(run: AgentRunRecord): Promise<void>;
}

export interface ScoutRunSummary {
  status: "completed" | "skipped";
  /**
   * Why the run did not search. `low_credits` is a skip. The others are a completed idle:
   * the gate did not run, so the run must not be read as "0 passed gate".
   */
  reason?: "low_credits" | "trial_cap" | "pool_full" | "preview_full";
  /** raw prospects this run intended to pull (0 = pool full / trial cap / no channel — discovery
   *  idled by design). target > 0 with discovered 0 is the ops signal that the source came back empty. */
  discoveryTarget: number;
  /** ICPs whose criteria were derived from free text and persisted this run */
  criteriaDerived: number;
  /** ICPs still without usable criteria after a failed derivation — retried next run */
  criteriaPending: number;
  discovered: number;
  gatePassed: number;
  qualified: number;
  chained: boolean;
  /** survivors the model omitted after one retry (score-0 miss rows still persisted) */
  rankMissed: number;
  /** survivors miss-scored because rankFn threw */
  rankErrors: number;
  /** website scan threw — rank ran without seller-site context */
  websiteScanError: boolean;
  /** company-signal fetch threw — rank ran without company events */
  companySignalsError: boolean;
  /** ML-1: the learner's strongest winning/losing features at run time (null if unavailable) */
  learned?: LearnedInsights | null;
  /** ML-7: lead profiles embedded this run (lookalike similarity) */
  embedded?: number;
}

/** The learner's readout persisted with each scout run: which ordering is live, plus the account's
 *  OWN-data feature readout the web app renders (ML-2 — never pool-derived). */
export type LearnedInsights = LearnedReadout & { mode: "learned" | "tilt" };

export interface CopyDraftPayload {
  copyAgentId: string;
  accountId: string;
  leadIds: string[];
}

// ── Intent Agent (Phase 13) ──────────────────────────────────────────────────

/** Per-run read ceilings — account-safety (rule 04). LinkedIn reads run through the user's
 *  own connected account, so the scheduler caps reads per run; not configurable upward. */
export const INTENT_POSTS_PER_RUN = 20;
export const INTENT_ENGAGERS_PER_POST = 25;
/** ML-8: new followers processed per run (beyond this they wait for the next run — still followers). */
export const INTENT_FOLLOWERS_PER_RUN = 25;

export interface IntentConfig {
  watch: { creators: string[]; competitors: string[]; keywords: string[]; hashtags: string[] };
  /** follows (ML-8): people who start following the connected profile — warm, wordless */
  signals: { engagement: boolean; content: boolean; follows?: boolean };
  /** qualification threshold (the same bar the Scout uses, rule 06) */
  minScore: number;
}

export const INTENT_DEFAULTS: IntentConfig = {
  watch: { creators: [], competitors: [], keywords: [], hashtags: [] },
  signals: { engagement: true, content: true, follows: true },
  minScore: 70,
};

export interface IntentScanContext {
  agent: {
    id: string;
    accountId: string;
    status: string;
    config: Partial<IntentConfig>;
    /** ML-8: intraday runs split the per-run read budget so daily LinkedIn reads stay flat */
    cadence?: "daily" | "weekly" | "intraday" | null;
  };
  /** the LinkedIn account to read through (the account's active connection); null = can't read */
  connectedAccountId: string | null;
  /** qualification ICP — inherited from the account's Scout (intent qualifies against the same bar) */
  icps: { id: string; name: string; criteria: IcpCriteria }[];
  account: { industry: string | null; valueProp: string | null; subscriptionStatus: string };
  /** ML-5: the Scout's targeting rules (raw agents.config.targeting) — intent leads obey them too */
  targeting?: unknown;
}

/** A persisted observation row — the dedupe ledger + audit trail. */
export interface IntentObservationRow {
  profileUrl: string;
  postRef: string;
  signalKind: "engagement" | "content" | "follow";
  watchTarget: string | null;
  headline: string | null;
  detail: string | null;
  outcome: "observed" | "qualified" | "rejected" | "suppressed" | "enrolled";
  leadId: string | null;
}

export interface IntentScanStore {
  getIntentContext(agentId: string): Promise<IntentScanContext | null>;
  /** dedupe: return the `${profileUrl}|${postRef}` keys already recorded for the account */
  seenObservationKeys(accountId: string, refs: { profileUrl: string; postRef: string }[]): Promise<Set<string>>;
  /** persist the observation ledger (service-role insert; the unique index is the backstop) */
  recordObservations(accountId: string, agentId: string, rows: IntentObservationRow[]): Promise<void>;
  /** upsert an intent-sourced lead (source 'intent'), deduped by profile url; returns its id.
   *  When the candidate passed a specific ICP's rules gate, persist that icpId on insert. */
  upsertIntentLead(accountId: string, candidate: ProspectCandidate, icpId?: string): Promise<{ leadId: string }>;
  markRulesGate(leadId: string, result: RulesGateResult): Promise<void>;
  saveScore(leadId: string, insights: LeadInsights, qualified: boolean): Promise<void>;
  /** capture the "why now" intent signal on the lead — feeds Surface A's why-now chip */
  saveIntentSignal(
    leadId: string,
    accountId: string,
    signal: { label: string; detail: string; level?: string; kind?: "intent" | "follow" }
  ): Promise<void>;
  /** ML-1 fit feedback — same contract as ScoutStore.getRankFeedback */
  getRankFeedback(accountId: string): Promise<{ rejected: string[]; positive: string[] }>;
  /** the rule-11 gate: account + lowercased LinkedIn URL lookup against suppression_entries */
  isSuppressed(accountId: string, kind: "linkedin", value: string): Promise<boolean>;
  getLiveCopyAgent(accountId: string): Promise<{ id: string } | null>;
  completeRun(agentId: string, lastRunAt: Date): Promise<void>;
}

export interface IntentScanDeps {
  store: IntentScanStore;
  linkedin: Pick<LinkedInInfra, "searchPosts" | "listProfilePosts" | "listPostEngagers" | "getProfile" | "listFollowers">;
  classifyFn: (observations: IntentObservationInput[], ctx: IntentContext) => Promise<IntentVerdict[]>;
  rankFn: (candidates: RankCandidate[], ctx: RankContext) => Promise<LeadInsights[]>;
  triggerCopyDraft: (payload: CopyDraftPayload) => Promise<void>;
  now?: () => Date;
}

export interface IntentScanSummary {
  status: "completed" | "skipped" | "failed";
  reason?: "no_connection" | "empty_watchlist" | "all_targets_failed";
  /** watch targets this run attempted to read */
  targets: number;
  /** targets whose provider read FAILED (swallowed per-target so one bad read never sinks the
   *  run) — targets > 0 with sourcingErrors === targets means the source is dead, not quiet
   *  (a disconnected account once reported "observed 0" as healthy for 2 days). */
  sourcingErrors: number;
  observed: number;
  intent: number;
  qualified: number;
  chained: boolean;
  rankMissed: number;
  rankErrors: number;
  /** ML-8: followers read this run (the warm "follows you" signal) */
  followers?: number;
}

export interface CopyConfig {
  cta: string;
  /** the seller's meeting-booking URL (0044) — the conversation brain offers it once when the
   *  prospect shows interest in talking; null until set in the Outreach agent's settings */
  bookingUrl?: string | null;
  /** the seller's destination page — offered once when the prospect wants to see/learn rather
   *  than talk; the conversion path for traffic-first businesses (no booking required) */
  websiteUrl?: string | null;
  /** LinkedIn is the only channel; retained as an object for back-compat with stored agent configs. */
  channels: { linkedin: boolean };
}

export interface CopyContext {
  agent: { id: string; accountId: string; status: string; campaignId: string | null; config: CopyConfig; sendMode: "review" | "automatic" };
  assets: { kind: string; url: string | null; filename: string | null }[];
  account: {
    industry: string | null;
    websiteScan: (WebsiteScan & { url?: string }) | null;
    /** 0061 seller-authored positioning (null → falls back to the website-scan summary / omitted). */
    valueProp: string | null;
    brandVoice: string | null;
    guardrails: string | null;
  };
  /** recent sent openers — anti-template "do not reuse" list for the draft prompt (0044) */
  avoidPhrases: string[];
  /** openers from THIS account that earned interested replies — Vera's positive memory,
   *  injected as guide-for-angle exemplars (Stage 0.5). Derived at read time, never stored. */
  winningOpeners: string[];
  /**
   * Count of the account's citable proof points (config-aware selection, spec 2026-07-21) — feeds
   * `deriveAccountProfile`'s proofDepth. A COUNT only (never the proof text) so the profile stays a
   * config-derived approach prior, never a fact source. Optional/absent ⇒ 0 (proofDepth "none").
   */
  proofCount?: number;
}

export interface DraftableLead {
  id: string;
  firstName: string | null;
  lastName: string | null;
  title: string | null;
  companyName: string | null;
  industry: string | null;
  email: string | null;
  linkedinUrl: string | null;
  phone: string | null;
  aiInsights: StoredInsights | null;
  /** leads.ai_score. Ranking for the daily draft cap. Not stored inside aiInsights. */
  aiScore: number | null;
  /** when the lead was last AI-ranked; drives refresh-on-release before a delayed email touch */
  scoredAt: Date | null;
  /** ML-3: freshest captured reach-out-worthy signal (pickWhyNow) — the opener must cite it */
  whyNow?: WhyNow | null;
}

export interface NewScheduledSend {
  accountId: string;
  campaignId: string;
  leadId: string;
  channel: "linkedin";
  subject: string | null;
  body: string;
  /** automatic mode inserts clean drafts as 'approved'; style-flagged drafts always review */
  status: "pending_review" | "approved";
  /** invite/message pair for LinkedIn (0009) */
  linkedinStage: "invite" | "message" | null;
  /** which machine queued it (0044): 'reply_response' rides the dispatch priority lane;
   *  omitted = 'sequence' (full pacing + send windows) */
  origin?: "sequence" | "reply_response" | "manual";
  styleFlags: string | null;
  /** message-level recipe stamp (Stage 1) — null/omitted only for human-typed sends */
  recipe?: SendRecipe | null;
}

export interface CopyDraftStore {
  /** best-first order for these leads — the same ordering the scout drain uses (ML-1 learner when
   *  informative, else ai_score + tilt). Ids the store can't order are appended in input order. */
  rankLeadIds(accountId: string, leadIds: string[]): Promise<string[]>;
  getCopyContext(copyAgentId: string): Promise<CopyContext | null>;
  getDraftableLeads(accountId: string, leadIds: string[]): Promise<DraftableLead[]>;
  /** idempotency guard: which of these leadIds already have a scheduled_send, so a retried run never re-drafts */
  leadsWithExistingSends(accountId: string, leadIds: string[]): Promise<Set<string>>;
  /** the rule-11 gate: account + lowercased LinkedIn URL lookup against suppression_entries */
  isSuppressed(accountId: string, kind: "linkedin", value: string): Promise<boolean>;
  ensureCampaignLead(campaignId: string, leadId: string, accountId: string): Promise<void>;
  setCampaignLeadStatus(
    campaignId: string,
    leadId: string,
    status: "queued" | "suppressed" | "skipped" | "sent"
  ): Promise<void>;
  insertScheduledSend(send: NewScheduledSend): Promise<void>;
  /** Both rows or neither — the dispatch core assumes complete pairs. */
  insertLinkedInSendPair(invite: NewScheduledSend, message: NewScheduledSend): Promise<void>;
  setLeadStatus(leadId: string, status: "in_campaign"): Promise<void>;
  /** the account's playbook champion strategy + version; {strategy:{}, version:null} when none */
  getChampion(accountId: string): Promise<{ strategy: CopyStrategy; version: number | null }>;
  /**
   * The `best_of_n` app-setting (Task 3, quality lever 2) — a GLOBAL rollout knob (app_settings
   * has no accountId), not per-account config. Default 1 (today's single-draft behavior) when
   * unset or not a positive number; the pipeline core re-caps whatever this returns at
   * MAX_BEST_OF_N regardless.
   */
  getBestOfN(): Promise<number>;
  /**
   * The `message_shape_auto` app-setting (message-shape selector, spec 2026-07-20) — a GLOBAL
   * rollout knob. false (default, whenever the row is absent or not exactly `true`) keeps the
   * champion's opener structure byte-identical to today. true lets the champion default become the
   * signal-justified SAFE shape per lead (`selectMessageShape`). Same appSettings/eq-by-key pattern
   * as getBestOfN/getAdoptionMode.
   */
  getMessageShapeAuto(): Promise<boolean>;
  /**
   * Invite rows created since `since` for this account. Sequence messages and inbound replies
   * use linkedin_stage "message" and do not count. The daily first-touch cap reads this.
   */
  countFirstTouchDraftsSince(accountId: string, since: Date): Promise<number>;
}

/** A1 genome stamp. Writes a record at lead entry. Does not draft or send. */
export type CohortWindow = { since?: Date; until?: Date };

export interface StrategyStampStore {
  upsertStrategy(accountId: string, genome: StrategyGenome, source: StrategySource): Promise<string>;
  hasStrategyStamp(accountId: string, leadId: string): Promise<boolean>;
  stampLead(
    accountId: string,
    leadId: string,
    strategyId: string,
    opts?: { experimentId?: string | null; arm?: StampArm }
  ): Promise<void>;
  /** Non-suppressed leads in the window, counted into the calibrate.ts cohort shape. */
  getFunnelCohort(accountId: string, window?: CohortWindow): Promise<FunnelCohort>;
}

export interface CopyDraftDeps {
  store: CopyDraftStore;
  draftLinkedInFn: (input: DraftInput) => Promise<LinkedInDraft>;
  /**
   * The `conversation_policy` rollout knob, read once per run by the thin trigger (spec §7.2/§9).
   * "live" ⇒ the invite note ONLY, from `draftLinkedInNoteFn`; the first message is written at
   * acceptance by the first-message scan through the conversation core. "off" / "shadow" /
   * "live_replies" ⇒ today's invite+message pair from `draftLinkedInFn`, byte-identical (in shadow
   * and live_replies the scan logs a shadow decision against the parked pair message).
   */
  conversationMode: ConversationMode;
  /** Note-only first-touch brain (lints itself); used only when `conversationMode === "live"`. */
  draftLinkedInNoteFn: (input: DraftInput) => Promise<LinkedInNoteDraft>;
  /**
   * One targeted EDIT of a style-flagged pair, run only on the AUTOMATIC send path before the
   * draft may auto-approve (review mode surfaces the flags + the queue's Fix button instead).
   * The fix is re-linted with the same validator; still-flagged output waits in review (rule 06/11).
   */
  fixLinkedInFn?: (draft: LinkedInDraft, input: DraftInput) => Promise<LinkedInDraft>;
  /**
   * Best-of-N judge (Task 3, quality lever 2). Absent ⇒ best-of-N is forced OFF (n=1) regardless
   * of `bestOfN` config below — there's no point drafting N candidates with nothing to rank them.
   * Advisory ranking only: the judge picks among candidates that already exist, it never bypasses
   * the humanizer/fixLinkedInFn gate that runs on whichever candidate it picks.
   */
  judgeFn?: JudgeFn;
  /**
   * Desired best-of-N candidate count, resolved from the `best_of_n` app-setting by the thin
   * trigger (default 1 = today's single-draft behavior). The pipeline core re-caps this at
   * MAX_BEST_OF_N regardless of what's configured, and forces it to 1 when `judgeFn` is absent.
   */
  bestOfN?: number;
  /**
   * Message-shape selector champion default (spec 2026-07-20) — resolved from the
   * `message_shape_auto` app-setting by the thin trigger. Absent/false (default) ⇒ the champion's
   * opener structure is byte-identical to today; true ⇒ the champion default becomes the
   * signal-justified SAFE shape per lead.
   */
  messageShapeAuto?: boolean;
}

export interface CopyDraftSummary {
  status: "completed" | "skipped";
  drafted: number;
  suppressed: number;
  skipped: number;
  /** Qualified leads left undrafted because the daily first-touch cap was full. Not skipped. */
  deferred: number;
}

export interface SendContext {
  id: string;
  accountId: string;
  campaignId: string;
  leadId: string;
  channel: "linkedin";
  linkedinStage: "invite" | "message" | null;
  status: string;
  subject: string | null;
  body: string | null;
  campaignStatus: string;
  accountPaused: boolean;
  /** status = the lead's pipeline status (archived/rejected leads are never sent to) */
  lead: { linkedinUrl: string | null; status: string };
}

export interface OutreachSendStore {
  getSendContext(sendId: string): Promise<SendContext | null>;
  isKillSwitchOn(): Promise<boolean>;
  isSuppressed(accountId: string, kind: "linkedin", value: string): Promise<boolean>;
  /** optimistic claim: scheduled → sending; false means another run owns it */
  claimSending(sendId: string): Promise<boolean>;
  revertToApproved(sendId: string): Promise<void>;
  markSent(sendId: string): Promise<void>;
  markFailed(sendId: string, error: string): Promise<void>;
  markSuppressed(sendId: string): Promise<void>;
  /** cancel the lead's not-yet-sent follow-up messages; returns how many were canceled */
  cancelUnsentFollowups(leadId: string, reason: string): Promise<number>;
  /** The sticky sender assigned to this lead (multi-sender, rule 04/13). Null = unassigned
   *  (the dispatcher assigns at invite time) → the send parks until the next dispatch cycle. */
  getLeadAssignedIdentity(leadId: string): Promise<{ id: string; providerRef: string; status: string } | null>;
  recordOutreachSend(rec: {
    accountId: string;
    campaignId: string;
    leadId: string;
    scheduledSendId: string;
    channel: "linkedin";
    linkedinAccountId?: string;
    messageRef: string | null;
  }): Promise<void>;
  setLeadInvited(leadId: string, at: Date): Promise<void>;
  /** Persist the prospect's member provider_id resolved at send time — the reply-attribution
   *  key inbound webhooks match on (0043). Idempotent overwrite. */
  saveLeadProviderRef(leadId: string, providerRef: string): Promise<void>;
  setCampaignLeadStatus(campaignId: string, leadId: string, status: "queued" | "suppressed" | "skipped" | "sent"): Promise<void>;
  /** Fresh per-lead facts for the send-boundary pacing re-check (message stage only). Dispatch's
   *  claim ran up to a jitter-delay earlier and can't be trusted across it — same rationale as
   *  the suppression re-check. `duplicateBodyDelivered` = an identical body already DELIVERED
   *  to this lead (double-submitted compose, replayed draft). */
  getLeadMessageGuardFacts(leadId: string, body: string | null): Promise<{
    lastMessageDeliveredAt: Date | null;
    lastReplyAt: Date | null;
    duplicateBodyDelivered: boolean;
  }>;
  cancelSend(sendId: string, error: string): Promise<void>;
}

export interface OutreachSendDeps {
  store: OutreachSendStore;
  linkedinInfra: LinkedInInfra;
  now?: () => Date;
  /**
   * Raw provider error on a failed send — logged server-side (task logs) BEFORE the message is
   * sanitized for the user-facing scheduled_sends.error column, so the actual provider reason
   * (e.g. the 400/403 body) is diagnosable. Never written to the DB.
   */
  onProviderError?: (detail: string) => void;
}

export type OutreachSendOutcome =
  | "sent"
  | "suppressed"
  | "parked"
  | "failed"
  | "skipped"
  | "canceled"
  /** the provider call timed out — it may have gone out, so the row is left as-is (never resent) */
  | "ambiguous"
  /** the sender's LinkedIn session is dead — send parked; wrapper fires an immediate health check */
  | "sender_disconnected";

export interface DispatchableSend {
  id: string;
  accountId: string;
  campaignId: string;
  leadId: string;
  channel: "linkedin";
  linkedinStage: "invite" | "message" | null;
  status: "approved" | "scheduled";
  createdAt: Date;
  accountPaused: boolean;
  campaignStatus: string;
  leadInvitedAt: Date | null;
  leadConnectedAt: Date | null;
  /** When the last agent MESSAGE to this lead actually delivered — drives the per-lead
   *  proactive gap so a drained backlog can never land two messages minutes apart. */
  leadLastMessageSentAt: Date | null;
  /** When the lead last replied. A reply after our last message exempts the gap — answering
   *  a prospect promptly is human behavior; a second proactive nudge minutes later is not. */
  leadRepliedAt: Date | null;
  /** Another message row for this lead is already claimed and undelivered (status 'scheduled'
   *  with a live runAt, or 'sending'). The per-lead clock advances on DELIVERIES, so claim-time
   *  facts can't see a sibling claim — two rows approved across adjacent ticks used to both fly
   *  minutes apart (2026-07-07 triple-send). One claimed message per lead at a time. */
  leadHasInFlightMessage: boolean;
  /** which machine queued it (0044) — reply responses jump the pacing queue; manual sends
   *  skip the send window (a human chose to send now) */
  origin: "sequence" | "reply_response" | "manual";
  /** free-text lead location — drives the proactive business-hours send window */
  leadLocation: string | null;
  /** Multi-sender: the LinkedIn account already assigned to this lead (rule 04/13).
   *  Null until first invite — invites without one are assigned here; a connected
   *  lead's messages are LOCKED to this account (can't message from another). */
  leadAssignedSenderId: string | null;
  /** Drives the trial send cap; 'trialing' accounts are bounded by TRIAL_SEND_CAP. */
  subscriptionStatus: string;
  /** Admin workspace: no trial send cap and no weekday send window. */
  unconstrained?: boolean;
}

/** One of a tenant's connected LinkedIn sender accounts, with its current safety state.
 *  Extends the invite-selector's SenderCandidate with today's message count so the
 *  dispatcher can budget invites and messages per account independently (rule 04). */
export interface DispatchSender extends SenderCandidate {
  /** Messages this account has already sent today (its own message cap is independent). */
  sentTodayMessages: number;
  /** Epoch ms of this account's latest already-scheduled send (0 if none) — pacing continues after it. */
  scheduledUntil: number;
}

export interface SendDispatchStore {
  isKillSwitchOn(): Promise<boolean>;
  /** approved rows + scheduled rows whose scheduled_for is older than staleCutoff (lost-task recovery) */
  getDispatchableSends(staleCutoff: Date): Promise<DispatchableSend[]>;
  /** Total sends recorded for the account (outreach_sends) — enforces TRIAL_SEND_CAP. */
  countAccountSends(accountId: string): Promise<number>;
  /** Every active LinkedIn sender for the tenant with its current safety state
   *  (age, invites today, invites last 7d, messages today, last-assigned, health).
   *  Empty array = no connected identity. Per-sender caps replace the old per-tenant counts. */
  listSenderCandidates(accountId: string, now: Date): Promise<DispatchSender[]>;
  /** Persist the sticky sender choice on the lead (set once at first invite). */
  assignLeadSender(leadId: string, linkedinAccountId: string): Promise<void>;
  markScheduled(sendId: string, scheduledFor: Date): Promise<void>;
  cancelSend(sendId: string, error: string): Promise<void>;
}

export interface SendDispatchDeps {
  store: SendDispatchStore;
  /** wrapper triggers the outreach-send task with a delay */
  enqueue: (sendId: string, runAt: Date) => Promise<void>;
  now?: () => Date;
}

export interface SendDispatchSummary {
  status: "halted" | "completed";
  scheduled: number;
  canceled: number;
  skipped: number;
}

export interface PurgeCandidate {
  id: string;
  status: string;
  rulesGatePassed: boolean | null;
  scoredAt: Date | null;
}

export interface RetentionStore {
  /** leads with created_at < cutoff and status in ('sourced','rejected') — pre-filter only, isPurgeable decides */
  getPurgeCandidates(cutoff: Date): Promise<PurgeCandidate[]>;
  deleteLeads(ids: string[]): Promise<number>;
  /** webhook_events rows with received_at < cutoff — debugging/idempotency data, purged after 30 days (rule 11) */
  purgeWebhookEvents(cutoff: Date): Promise<number>;
  /** copilot_conversations rows with updated_at < cutoff — cascades copilot_messages via FK on delete cascade (0011) */
  purgeOldCopilotConversations(cutoff: Date): Promise<number>;
}

export interface RetentionDeps {
  store: RetentionStore;
  now?: () => Date;
}

export interface RetentionSummary {
  status: "completed";
  purged: number;
  cutoff: string;
  webhookEventsPurged: number;
  copilotConversationsPurged: number;
}

export interface ExpiredTrialAccount {
  id: string;
}

export interface TrialStore {
  /** accounts still on a no-card trial (status='trialing', no Stripe sub) past trial_ends_at */
  getExpiredTrialAccounts(now: Date): Promise<ExpiredTrialAccount[]>;
  /** flip lapsed trials to plan='none', status='none', outreach paused — returns rows changed */
  expireTrials(ids: string[]): Promise<number>;
}

export interface TrialExpiryDeps {
  store: TrialStore;
  /** 0045: capture lapsing accounts as trial_lapsed touches at the moment of expiry */
  lifecycle?: Pick<LifecycleStore, "enqueueTrialLapsedForAccounts">;
  now?: () => Date;
}

export interface TrialExpirySummary {
  status: "completed";
  expired: number;
}

export interface InboundPayload {
  source: "linkedin";
  payload: unknown;
  accountId?: string;
}

export interface InboundStore {
  findLinkedInAccountByProviderRef(ref: string): Promise<{ id: string; accountId: string } | null>;
  /**
   * insert-or-update by (accountId, providerRef); sets connected_at when turning active.
   * 'restricted' is written as-is to linkedin_accounts.status (enum already includes the value);
   * connectedAt is preserved on restrict — only reset on reconnect (active).
   *
   * Identity dedupe: an ACTIVE arrival for a profile the tenant already holds under a
   * DIFFERENT provider ref is a reconnect that minted a fresh provider account — the
   * existing row is revived in place (same row id, so lead assignments and send history
   * survive) and the replaced/duplicate refs are returned for provider-side seat cleanup.
   */
  upsertLinkedInAccountStatus(e: {
    vanteraAccountId: string;
    providerRef: string;
    status: "active" | "restricted" | "disconnected";
    profileUrl: string | null;
    displayName: string | null;
  }): Promise<{ supersededRefs: string[] }>;
  findLeadByLinkedInUrl(accountId: string, normalizedUrl: string): Promise<{ id: string; campaignId: string | null } | null>;
  /** PRIMARY reply-attribution lookup: the member provider_id captured at send time (0043). */
  findLeadByProviderRef(accountId: string, providerRef: string): Promise<{ id: string; campaignId: string | null } | null>;
  /** Unique-name fallback among leads we actually contacted (invited or beyond). Exact
   *  case-insensitive full-name match; return at most 2 rows — the caller only matches
   *  when the name is unambiguous. */
  findContactedLeadsByName(accountId: string, name: string): Promise<Array<{ id: string; campaignId: string | null }>>;
  /** Backfill/refresh the provider ref whenever any match succeeds (self-healing key). */
  saveLeadProviderRef(leadId: string, providerRef: string): Promise<void>;
  insertReply(r: {
    accountId: string;
    leadId: string;
    campaignId: string | null;
    channel: "linkedin";
    providerMessageRef: string | null;
    body: string;
    receivedAt: Date;
  }): Promise<{
    id: string;
    created: boolean;
    /** OUR ingestion time (replies.created_at) — the clock queued drafts are compared against */
    createdAt: Date;
    /** the row already carries a classification — the processed marker (set LAST by runInbound),
     *  so an existing-but-unclassified row is a crashed run to finish, not a duplicate */
    classified: boolean;
    /** the reader's readout already persisted on the row (a crashed run's retry reuses it, never
     *  re-reading the turn against a state that already includes it); null on a fresh row */
    readout: Readout | null;
  }>;
  /** Attribute a reply to the agent send it answered. `scheduledSendId` is the delivered
   *  scheduled_sends row (null = none); the store resolves it to its outreach_sends audit row. */
  setReplyOutreachSend(replyId: string, scheduledSendId: string | null): Promise<void>;
  /** Newest delivered (status 'sent', invite|message) scheduled send for the lead at or before
   *  `before`; delivery time = coalesce(max(outreach_sends.sent_at), updated_at). */
  lastDeliveredSendId(accountId: string, leadId: string, before: Date): Promise<string | null>;
  /** Written LAST in reply processing: classification doubles as the "fully processed" marker. */
  setReplyClassification(replyId: string, verdict: ReplyVerdict): Promise<void>;
  /** Persist the conversation reader's structured readout of an inbound reply (0074 replies.readout). */
  setReplyReadout(replyId: string, readout: Readout): Promise<void>;
  /** The lead's STORED LinkedIn URL — the value every send-path suppression check compares
   *  against (rule 11). Inbound payloads carry a provider-id URL form that rarely matches it. */
  getLeadLinkedInUrl(accountId: string, leadId: string): Promise<string | null>;
  isSuppressed(accountId: string, kind: "linkedin", value: string): Promise<boolean>;
  /**
   * True when an outbound LinkedIn message in this lead's thread is one Vantera sent (its provider
   * message id is on an outreach_sends row, or its text matches a send already in flight/sent —
   * the in-flight match covers the echo racing our post-send bookkeeping).
   */
  isOwnOutboundMessage(accountId: string, leadId: string, providerMessageRef: string, body: string): Promise<boolean>;
  /**
   * Human takeover (the pipeline twin of the in-app manual reply): cancel the agent's queued drafts
   * (never manual sends) and hold the lead's runs at paused_reply — inserting a paused marker run on
   * `campaignId` when the lead has none — so neither the responder nor proactive touches message on
   * top of the person now driving the thread.
   */
  pauseForHumanTakeover(accountId: string, leadId: string, campaignId: string | null): Promise<void>;
  /**
   * Mirror a message the account owner typed natively in LinkedIn into the lead's thread (0073).
   * Idempotent on (accountId, providerMessageRef): `created` is false when it was already stored,
   * which is how a replay or a sync pass knows not to react to it a second time.
   */
  insertNativeMessage(m: {
    accountId: string;
    leadId: string;
    providerMessageRef: string;
    body: string;
    sentAt: Date;
  }): Promise<{ created: boolean }>;
  addSuppression(
    accountId: string,
    kind: "linkedin",
    value: string,
    source: "unsubscribe" | "not_interested",
    leadId?: string
  ): Promise<void>;
  setLeadConnected(leadId: string, at: Date): Promise<void>;
  setLeadReplied(leadId: string, campaignId: string | null): Promise<void>;
  /** Stamp meeting_booked_at when a reply confirms a scheduled meeting (first booking wins). */
  markMeetingBooked(leadId: string, at: Date): Promise<void>;
  /** pending_review/approved/scheduled drafts for the lead → canceled; returns count */
  cancelPendingSends(leadId: string): Promise<number>;
  /**
   * Stop the lead's active sequence run → 'stopped'. Called ONLY for hard-negative replies
   * (not_interested / unsubscribe). A plain reply no longer stops outbound: the sequence keeps
   * nurturing until the lead converts (conversion gate) or is exhausted.
   */
  stopSequenceForReply(leadId: string): Promise<void>;
  insertLeadNotification(n: {
    accountId: string;
    leadId: string;
    kind: "reply" | "needs_human" | "meeting_booked";
    body: string;
  }): Promise<void>;
  /**
   * A live prospect replied: put their run back in CONVERSATION cadence — status active,
   * one touch of headroom, next nudge at `nextActionAt` — so an engaged thread never dies
   * with the cold sequence (2026-07-08: replied leads were exhausting at 2 cold touches).
   * The MAX_AGENT_TURNS cap in sequence-touch bounds total agent messages.
   * Revives ONLY active/exhausted runs: 'stopped' is a deliberate stand-down (hard negative,
   * booking, calendar, turn-cap hand-off) and never re-arms; nor does a booked or suppressed lead.
   */
  reviveSequenceRun(leadId: string, nextActionAt: Date): Promise<void>;
  /**
   * Inputs for an ACTIVE contextual reply (the "converse to close" step): the live Outreach agent's
   * grounding + send mode + the running thread for this lead. Returns null when there's no live
   * Outreach agent or the lead has no insights to ground a reply — the responder then stays silent
   * and the inbound reply is merely classified + the user notified (the prior behavior).
   */
  getResponderBundle(
    accountId: string,
    leadId: string,
    campaignId: string | null,
    opts?: { excludeReplyId?: string }
  ): Promise<ResponderBundle | null>;
  /** Queue the contextual reply as a message-stage send — the existing dispatch path delivers it. */
  insertScheduledSend(send: NewScheduledSend): Promise<void>;
}

/** Everything runInbound needs to draft + queue one contextual reply with the outreach copy logic. */
export interface ResponderBundle {
  campaignId: string;
  /** the Outreach agent's send mode: 'automatic' auto-sends a clean reply; 'review' queues it */
  sendMode: "review" | "automatic";
  lead: CopyLead;
  insights: StoredInsights;
  /** same grounding the first-touch copy used — CTA, value prop, seller identity, guardrails */
  context: BrainCopyContext;
  /** prior messages in the thread, oldest first by DELIVERY time (excludes the incoming reply when
   *  `excludeReplyId` is passed, and out-of-office auto-replies, which aren't conversation) */
  thread: ConversationTurn[];
  /** prior AGENT messages actually sent in this thread — drives the converse-to-close turn cap.
   *  Human (manual) messages are thread context, never agent turns. */
  agentTurns: number;
  /** created_at of the NEWEST queued/in-flight message for this lead (null = none). Sequence
   *  touches skip whenever one exists (never stack). The responder compares it to the reply's
   *  receivedAt: a draft newer than the reply IS the answer; an older one was drafted blind to
   *  what the lead said and gets superseded, not deferred to. */
  newestUnsentMessageCreatedAt: Date | null;
  /** when the last agent message to this lead actually DELIVERED (null = never messaged) —
   *  proactive touches keep a minimum delivery-time gap so a held backlog can't collapse
   *  the cadence into a burst */
  lastAgentMessageAt: Date | null;
  /** a human took this thread over (replied manually → run is `paused_reply`). Both the reply
   *  responder and proactive touches stand down: once a person is driving the conversation, the
   *  agent never messages on top of them until the user resumes automation. */
  humanHandled: boolean;
  /** carried onto every conversation send's recipe so message-level attribution is complete */
  attribution: {
    /** the strategy that shaped THIS message: the playbook champion */
    strategy: CopyStrategy;
    /** optimization_playbook.version at bundle-build time (null = no playbook yet) */
    playbookVersion: number | null;
  };
}

export interface InboundDeps {
  store: InboundStore;
  /** deleteConnectedAccount: seat cleanup after an identity merge (superseded provider refs). */
  linkedinInfra: Pick<LinkedInInfra, "parseEventWebhook" | "deleteConnectedAccount">;
  classifyFn: (body: string) => Promise<ReplyVerdict>;
  /**
   * Drafts the seller's next message with the same grounding + humanizer as outreach (the
   * "use the same logic as outreach to converse until close" contract). Absent = responder
   * disabled (a reply is only classified + notified, never auto-answered).
   */
  respondFn?: (input: ConversationMessageInput) => Promise<ConversationDraft>;
  /** AUTOMATIC-mode only: one targeted edit of a style-flagged reply before it may auto-send;
   *  re-linted with the same mid-conversation bar, still-flagged output waits in review. */
  fixReplyFn?: (
    original: ConversationDraft,
    input: ConversationMessageInput
  ) => Promise<ConversationDraft>;
  lifecycle?: InboundLifecycleHooks;
  /**
   * Moment-of-value emails (L3): called on interested replies, detected bookings, and
   * needs-human handoffs. Wrapper-wired (pref check + owner lookup + Resend); absent = no
   * emails (tests, dev). Always best-effort — failures never sink reply processing.
   */
  notifyLeadEvent?: (e: {
    kind: "interested_reply" | "meeting_booked" | "needs_human";
    accountId: string;
    leadId: string;
    snippet: string;
  }) => Promise<void>;
  now?: () => Date;
  /**
   * Best-of-N judge (Phase 2C fast-follow, extending Task 3 to the responder path). Absent ⇒
   * best-of-N is forced OFF (n=1) regardless of `bestOfN` config below — same rule as
   * copy-draft's judgeFn: no point drafting N candidates with nothing to rank them. Advisory
   * ranking only: the judge picks among candidates that already exist, it never bypasses the
   * humanizer/fixReplyFn gate that runs on whichever candidate it picks.
   */
  judgeFn?: JudgeFn;
  /**
   * Desired best-of-N candidate count, resolved from the `best_of_n` app-setting by the thin
   * trigger (default 1 = today's single-draft behavior). The pipeline core re-caps this at
   * MAX_BEST_OF_N regardless of what's configured, and forces it to 1 when `judgeFn` is absent.
   */
  bestOfN?: number;
  /**
   * Conversation intelligence (spec §6.4/§9). Absent or mode "off" ⇒ today's classifier-driven path,
   * byte-identical. Otherwise the reader's readout of the incoming reply drives suppression/stop,
   * and the conversation core runs (shadow: logs only, legacy responder still writes; live_replies /
   * live: replaces the legacy responder). `sellerName` overrides the bundle's account name.
   */
  conversation?: {
    mode: ConversationMode;
    deps: ConversationDecideDeps;
    sellerName?: string | null;
  };
}

export interface InboundSummary {
  handled: boolean;
  action: string;
}

// --- sequence orchestrator ---
export type SequenceStage = "linkedin";
export type SequenceCursor = SequenceStage | "done";
export type SequenceStatus = "active" | "paused_reply" | "converted" | "exhausted" | "stopped";

export interface StageConfig {
  enabled: boolean;
  touches: number;       // touches before the wait window
  touchGapDays: number;  // spacing between touches within the stage
  waitDays: number;      // conversion window held after the last touch
}

export interface SequenceConfig {
  order: SequenceStage[];
  stages: Record<SequenceStage, StageConfig>;
}

export interface SequenceRun {
  id: string;
  accountId: string;
  campaignId: string;
  leadId: string;
  status: SequenceStatus;
  currentStage: SequenceCursor;
  touchesDone: number;
  nextActionAt: Date;
  enteredStageAt: Date;
  /** one-shot soft-no revival timestamp (0044); null = revival still available */
  revivedAt: Date | null;
  /** when the run last dispatched a touch (null = never) */
  lastTouchAt: Date | null;
}

export interface LeadChannels {
  linkedinUrl: string | null;
}

export interface SequenceTickContext {
  run: SequenceRun;
  config: SequenceConfig;
  channels: LeadChannels;
  suppressed: { linkedin: boolean };
  accountPaused: boolean;
  killSwitch: boolean;
  /** the lead has replied at least once — an exhausting run earns ONE ~30-day revival */
  leadReplied: boolean;
  /** LinkedIn connection state: follow-ups only make sense once the invite is accepted */
  connection: { invitedAt: Date | null; connectedAt: Date | null };
  now: Date;
}

export interface SequenceRunPatch {
  status?: SequenceStatus;
  currentStage?: SequenceCursor;
  touchesDone?: number;
  nextActionAt?: Date;
  enteredStageAt?: Date;
  lastTouchAt?: Date;
  revivedAt?: Date;
}

export type SequenceDecision =
  | { kind: "hold" }
  | { kind: "dispatch"; stage: SequenceStage; touchNo: number; patch: SequenceRunPatch }
  | { kind: "advance"; patch: SequenceRunPatch }
  /** write the patch and stop this tick — the soft-no revival parks the run ~30 days out */
  | { kind: "park"; patch: SequenceRunPatch }
  /** write the patch and stop this tick without spending a touch — waiting on the connection */
  | { kind: "wait"; patch: SequenceRunPatch }
  | { kind: "exhaust"; patch: SequenceRunPatch };

export interface SequenceTouchDispatch {
  runId: string;
  accountId: string;
  campaignId: string;
  leadId: string;
  stage: SequenceStage;
  touchNo: number;
}

export interface DueSequenceRun {
  run: SequenceRun;
  channels: LeadChannels;
  config: SequenceConfig;
  accountPaused: boolean;
  /** the lead has replied at least once (drives the one-shot soft-no revival) */
  leadReplied: boolean;
  connection: { invitedAt: Date | null; connectedAt: Date | null };
}

export interface SequenceStore {
  /** active runs with next_action_at <= now, joined to lead channels + campaign config */
  getDueSequenceRuns(now: Date, limit: number): Promise<DueSequenceRun[]>;
  isKillSwitchOn(): Promise<boolean>;
  suppressionFlags(
    accountId: string,
    ch: LeadChannels
  ): Promise<{ linkedin: boolean }>;
  /** batched suppression for a whole orchestrator tick — one indexed query per account, not per run */
  suppressionFlagsForRuns(runs: DueSequenceRun[]): Promise<Map<string, { linkedin: boolean }>>;
  /** optimistic claim: only updates if status still 'active' AND next_action_at unchanged */
  applyRunPatch(runId: string, expectNextActionAt: Date, patch: SequenceRunPatch): Promise<boolean>;
  /** terminal archive used by the exhaust decision */
  archiveLead(leadId: string, campaignId: string): Promise<void>;
  /** enrol qualified in_campaign leads lacking an active run; returns count created */
  enrollPendingLeads(now: Date): Promise<number>;
}

export interface SequenceTouchStore {
  getDraftableLead(accountId: string, leadId: string): Promise<DraftableLead | null>;
  /** Same grounding + running thread the reply responder uses — so a follow-up touch builds on the
   *  conversation instead of re-sending a cold first message. null = no live Outreach agent / no
   *  insights ⇒ skip the touch. */
  getResponderBundle(accountId: string, leadId: string, campaignId: string | null): Promise<ResponderBundle | null>;
  isSuppressed(accountId: string, kind: "linkedin", value: string): Promise<boolean>;
  insertScheduledSend(send: NewScheduledSend): Promise<void>;
  /** stop a sequence run (lead exits the sequence — e.g. dropped below min_score on refresh) */
  stopSequenceRun(runId: string): Promise<void>;
  /** turn-cap handoff: tell the human the agent is stepping aside on this thread */
  insertLeadNotification(n: { accountId: string; leadId: string; kind: "needs_human"; body: string }): Promise<void>;
}

export interface SequenceTouchDeps {
  store: SequenceTouchStore;
  /** Drafts a PROACTIVE follow-up (no incoming reply) with the same brain the responder uses, so the
   *  message follows the thread. Returns the body + any unresolved humanizer violations. */
  draftFollowupFn: (input: ConversationMessageInput) => Promise<ConversationDraft>;
  /** AUTOMATIC-mode only: one targeted edit of a style-flagged follow-up before it may auto-send;
   *  re-linted with the same mid-conversation bar, still-flagged output waits in review. */
  fixFollowupFn?: (
    original: ConversationDraft,
    input: ConversationMessageInput
  ) => Promise<ConversationDraft>;
  /** current time (injectable for tests); used by the freshness check before a touch */
  now: () => Date;
  /**
   * Re-enrich + re-rank one aged lead before a touch. Returns "ok" (still
   * qualified — draft with current insights) or "dropped" (fell below min_score →
   * the caller exits the sequence; NOT suppression).
   */
  refreshLead: (accountId: string, leadId: string) => Promise<"ok" | "dropped">;
  /**
   * Best-of-N judge (Phase 2C fast-follow, extending Task 3 to the responder path). Absent ⇒
   * best-of-N is forced OFF (n=1) regardless of `bestOfN` config below — no point drafting N
   * candidates with nothing to rank them. Advisory ranking only: the judge picks among
   * candidates that already exist, it never bypasses the humanizer/fixFollowupFn gate that
   * runs on whichever candidate it picks.
   */
  judgeFn?: JudgeFn;
  /**
   * Desired best-of-N candidate count, resolved from the `best_of_n` app-setting by the thin
   * trigger (default 1 = today's single-draft behavior). The pipeline core re-caps this at
   * MAX_BEST_OF_N regardless of what's configured, and forces it to 1 when `judgeFn` is absent.
   */
  bestOfN?: number;
}

export type SequenceTouchOutcome = "drafted" | "suppressed" | "skipped" | "dropped" | "handed_off";

// ── Conversion gate (tracked-CTA redirect) ────────────────────────────────────

export interface ConnectionSyncStore {
  /** Leads we invited but never recorded connected — candidates for an acceptance backfill. */
  getInvitedUnacceptedLeads(accountId: string): Promise<{ leadId: string; profileUrl: string }[]>;
}

export interface ConversionStore {
  /** resolve a tracked CTA token to its lead/campaign/account; null if unknown/expired */
  resolveConversionToken(token: string): Promise<{ accountId: string; leadId: string; campaignId: string; targetUrl: string } | null>;
  setLeadConverted(leadId: string): Promise<void>;
  closeSequenceRun(campaignId: string, leadId: string): Promise<void>;
  cancelPendingSends(leadId: string): Promise<number>;
  setCampaignLeadStatus(campaignId: string, leadId: string, status: "completed"): Promise<void>;
  insertLeadNotification(n: { accountId: string; leadId: string; kind: "converted"; body: string }): Promise<void>;
}

export interface ConversionDeps {
  store: ConversionStore;
}

export interface ConversionResult {
  converted: boolean;
  redirectUrl: string | null;
}

// ── Lifecycle outreach (0045) — operator-side re-engagement DMs ──────────────

export type LifecycleSegment = "stalled_onboarding" | "idle_after_onboarding" | "trial_lapsed";

/** A user a segment scan wants to touch. */
export interface LifecycleCandidate {
  userId: string;
  accountId: string;
  displayName: string | null;
  linkedinUrl: string | null;
  /** segment A only: the onboarding step they stalled on (merge field) */
  stalledStep: string | null;
}

/** A sendable pending touch joined with fresh value-proof counts. */
export interface LifecycleDueTouch {
  id: string;
  userId: string;
  accountId: string | null;
  segment: LifecycleSegment;
  touchNumber: 1 | 2;
  linkedinUrl: string | null;
  displayName: string | null;
  stalledStep: string | null;
  /** invite gate state (booleans, not timestamps — raw-SQL rows skip driver date parsing) */
  inviteSent: boolean;
  connected: boolean;
  leadCount: number;
  qualifiedCount: number;
}

export interface LifecycleConfig {
  enabled: boolean;
  /** the founder identity's linkedin_accounts.provider_ref; null = feature inert */
  senderRef: string | null;
  dailyCap: number;
  /** free-text location fed to isWithinSendWindow (founder's business hours) */
  senderLocation: string;
  notifyEmail: string | null;
  lastRunAt: Date | null;
}

export interface LifecycleStore {
  getLifecycleConfig(): Promise<LifecycleConfig>;
  setLifecycleLastRun(now: Date): Promise<void>;
  isKillSwitchOn(): Promise<boolean>;
  getSenderRow(
    providerRef: string
  ): Promise<{ accountId: string; status: string; connectedAt: Date | null } | null>;
  /** admin-pin guard: owner emails for an account (role='owner' only) */
  getAccountOwnerEmails(accountId: string): Promise<string[]>;
  scanStalledOnboarding(now: Date, excludeAccountId: string): Promise<LifecycleCandidate[]>;
  scanIdleAfterOnboarding(now: Date, excludeAccountId: string): Promise<LifecycleCandidate[]>;
  /** pre-ship lapses only: trial_ends_at within the last 60 days */
  scanTrialLapsedBackfill(now: Date, excludeAccountId: string): Promise<LifecycleCandidate[]>;
  /** idempotent — the (user, segment, touch) unique index swallows re-scans */
  enqueueTouch(c: LifecycleCandidate, segment: LifecycleSegment, touchNumber: 1 | 2): Promise<void>;
  /** touch-2 derivation: touch-1 sent ≥4d ago, no reply, no touch-2 yet; returns rows created */
  enqueueDueFollowUps(now: Date): Promise<number>;
  /** status='pending', 30-day cooldown enforced, replied users excluded — oldest first */
  getDueTouches(now: Date, limit: number): Promise<LifecycleDueTouch[]>;
  markTouchSent(
    id: string,
    patch: { messageRef: string; body: string; targetProviderRef: string | null; sentAt: Date }
  ): Promise<void>;
  markTouchInvited(id: string, targetProviderRef: string | null, now: Date): Promise<void>;
  /** attempts+1; stays 'pending' for one retry, then parks as 'failed' */
  markTouchFailed(id: string, error: string): Promise<void>;
  markTouchSkipped(id: string): Promise<void>;
  /** stop-on-reply; null = the sender's inbound didn't match any lifecycle touch */
  recordLifecycleReply(
    who: { providerRef: string | null; profileUrl: string },
    now: Date
  ): Promise<{ userId: string; displayName: string | null } | null>;
  /** invite accepted: connected_at stamped, 'invited' flips back to 'pending' */
  recordLifecycleAcceptance(
    who: { providerRef: string | null; profileUrl: string },
    now: Date
  ): Promise<boolean>;
  /** trial-expiry chaining: enqueue touch-1 trial_lapsed rows BEFORE the accounts are flipped */
  enqueueTrialLapsedForAccounts(accountIds: string[]): Promise<number>;
}

export interface LifecycleOutreachDeps {
  store: LifecycleStore;
  linkedin: Pick<LinkedInInfra, "sendMessage" | "sendInvite" | "getConnectionState">;
  send: (alert: { to: string; subject: string; html: string; text: string }) => Promise<void>;
  /** inter-send pacing; tests inject a no-op */
  pause?: (ms: number) => Promise<void>;
  now?: () => Date;
}

export interface LifecycleOutreachSummary {
  status: "completed" | "skipped";
  reason?: "disabled" | "kill_switch" | "outside_window" | "already_ran" | "sender_unavailable" | "sender_not_admin";
  enqueued: number;
  followUps: number;
  messagesSent: number;
  invitesSent: number;
  skipped: number;
  failed: number;
}

/** Inbound interception (0045): events on the founder identity are operator traffic. */
export interface InboundLifecycleHooks {
  senderRef: string;
  recordReply: LifecycleStore["recordLifecycleReply"];
  recordAcceptance: LifecycleStore["recordLifecycleAcceptance"];
  notifyReply(displayName: string | null, body: string): Promise<void>;
}

// ── ML-6 calendar integration ────────────────────────────────────────────────────────────────

export type MeetingConnectionRow = { id: string; accountId: string; provider: "calendly" | "calcom"; status: string };

export interface MeetingEventStore {
  getMeetingConnection(connectionId: string): Promise<MeetingConnectionRow | null>;
  touchMeetingConnection(connectionId: string): Promise<void>;
  /** true only when the lead exists in THIS account — the tag can never cross workspaces */
  leadInAccount(accountId: string, leadId: string): Promise<boolean>;
  findLeadByEmail(accountId: string, email: string): Promise<string | null>;
  /** insert-or-update by (account, provider, booking_ref); attribution null = keep the stored value */
  upsertMeetingEvent(e: {
    accountId: string;
    connectionId: string;
    provider: "calendly" | "calcom";
    leadId: string;
    bookingRef: string;
    status: "booked" | "canceled";
    startAt: Date | null;
    attribution: "link" | "email" | null;
  }): Promise<void>;
  /** account-scoped: (account, provider, booking_ref) is the identity of a booking */
  findMeetingEvent(accountId: string, provider: string, bookingRef: string): Promise<{ leadId: string; status: "booked" | "canceled" } | null>;
  hasLiveBooking(accountId: string, leadId: string): Promise<boolean>;
  /** meeting_booked_at (first booking wins) + meeting_at + meeting_source='calendar' */
  markCalendarMeeting(accountId: string, leadId: string, startAt: Date | null): Promise<void>;
  /** clears meeting fields only when meeting_source='calendar' (never a manual/agent record) */
  clearCalendarMeeting(accountId: string, leadId: string): Promise<void>;
  /** cancel queued drafts + stop the active sequence — a lead who booked gets no more nudges */
  standDownOutreach(accountId: string, leadId: string): Promise<void>;
  notifyMeetingBooked(accountId: string, leadId: string): Promise<void>;
}

// ---- Conversation intelligence store (Task 10) ----

/** app_settings.conversation_policy rollout knob; anything but these four literals reads as "off". */
export type ConversationMode = "off" | "shadow" | "live_replies" | "live";

/** What woke the conversation policy for a lead. */
export type ConversationTrigger =
  | { kind: "reply"; replyId: string; incoming: string; receivedAt: Date; readout: Readout }
  | { kind: "first_message" }
  | { kind: "followup"; runId: string; touchNo: number; isLast: boolean };

export type NewDecision = {
  /** pre-generated id so the sent message's recipe can carry it before the row is written */
  id?: string;
  accountId: string;
  leadId: string;
  scheduledSendId: string | null;
  mode: "shadow" | "live";
  trigger: Trigger;
  phase: Phase;
  archetype: Archetype;
  move: Move;
  styleKey: string;
  propensity: number;
  seed: number;
  legalMoves: Move[];
  vetoes: Veto[];
  /** Shortlist.degraded from the policy; persisted inside the legal_moves jsonb object */
  degraded: string | null;
  stateSnapshot: ConversationState;
  composedBody: string | null;
  policyVersion: number;
  promptHash: string | null;
};

export type ScorableDecision = {
  id: string;
  accountId: string;
  leadId: string;
  scheduledSendId: string | null;
  decidedAt: Date;
  move: Move;
  phase: Phase;
  archetype: Archetype;
  propensity: number;
  composedBody: string | null;
  sentBody: string | null;
  sentAt: Date | null;
};

export interface ConversationStore {
  getConversationPolicyMode(): Promise<ConversationMode>;
  getConversationState(
    accountId: string,
    leadId: string
  ): Promise<{ state: ConversationState; lastMessageRef: string | null } | null>;
  saveConversationState(
    accountId: string,
    leadId: string,
    state: ConversationState,
    lastMessageRef: string | null
  ): Promise<void>;
  /** every stored message in the lead's thread, oldest first */
  listThreadTurns(accountId: string, leadId: string): Promise<StoredTurn[]>;
  insertDecision(d: NewDecision): Promise<string>;
  /** notBefore persists a reply delay as scheduled_for; status stays as given */
  insertScheduledSendReturningId(send: NewScheduledSend & { notBefore?: Date | null }): Promise<string>;
  /** account rows (source real) first, then global rows */
  readPriors(accountId: string): Promise<PriorTable>;
  /** null = global table. Replaces the stored rollup for each cell (the learner sends full rollups). */
  upsertPriors(accountId: string | null, cells: PriorTable): Promise<void>;
  listUnscoredDecisions(olderThan: Date, limit: number): Promise<ScorableDecision[]>;
  scoreDecision(id: string, outcome: DecisionOutcome, reward: number | null): Promise<void>;
  /**
   * Candidates for the first-message scan (spec §7.2), newest acceptance first: connected leads with
   * an active sequence run under a live Outreach agent, with no `first_message` decision at or after
   * `decidedSince`, whose prospect has not spoken since our last delivered touch (the reply path owns
   * those), and with no message-stage row — or, when `includeParked` (shadow / live_replies), no
   * message-stage row that is sent or sending (a parked legacy draft still qualifies).
   */
  listConnectedWithoutFirstMessage(
    limit: number,
    opts: { includeParked: boolean; decidedSince: Date }
  ): Promise<{ accountId: string; leadId: string; campaignId: string }[]>;
}

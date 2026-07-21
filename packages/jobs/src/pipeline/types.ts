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
  DraftInput,
  RankCandidate,
  RankContext,
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
  FunnelStageKey,
  GenerateRecipesInput,
  LeadOutcomeFlags,
  ExperimentStatus,
  SendRecipe,
  JudgeFn,
} from "@vantera/agent-brains";
import type { OutreachCapacity } from "./capacity";
import type { SenderCandidate } from "./sender-assignment";
import type { LinkedInInfra } from "@vantera/linkedin-infra";

export interface ScoutConfig {
  prospectsPerRun: number;
  minScore: number;
  /** capacity-throttle tunables (per-agent override via agents.config jsonb) */
  bufferFactor: number;
  floor: number;
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
}

export interface ScoutDeps {
  store: ScoutStore;
  prospectData: ProspectDataSource;
  /** Company-event buying signals (Phase 15) — only used on Intent-entitled plans; omitted = no-op. */
  companySignals?: CompanySignalSource;
  scanFn: (url: string) => Promise<WebsiteScan>;
  rankFn: (candidates: RankCandidate[], ctx: RankContext) => Promise<LeadInsights[]>;
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
  /** present only on a "skipped" run when the shared credit pool can't cover this run's worst case */
  reason?: "low_credits";
  /** raw prospects this run intended to pull (0 = pool full / no capacity — discovery idled by
   *  design). target > 0 with discovered 0 is the ops signal that the source came back empty. */
  discoveryTarget: number;
  /** ICPs whose criteria were derived from free text and persisted this run */
  criteriaDerived: number;
  /** ICPs still without usable criteria after a failed derivation — retried next run */
  criteriaPending: number;
  discovered: number;
  gatePassed: number;
  qualified: number;
  chained: boolean;
}

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

export interface IntentConfig {
  watch: { creators: string[]; competitors: string[]; keywords: string[]; hashtags: string[] };
  signals: { engagement: boolean; content: boolean };
  /** qualification threshold (the same bar the Scout uses, rule 06) */
  minScore: number;
}

export const INTENT_DEFAULTS: IntentConfig = {
  watch: { creators: [], competitors: [], keywords: [], hashtags: [] },
  signals: { engagement: true, content: true },
  minScore: 70,
};

export interface IntentScanContext {
  agent: { id: string; accountId: string; status: string; config: Partial<IntentConfig> };
  /** the LinkedIn account to read through (the account's active connection); null = can't read */
  connectedAccountId: string | null;
  /** qualification ICP — inherited from the account's Scout (intent qualifies against the same bar) */
  icps: { id: string; name: string; criteria: IcpCriteria }[];
  account: { industry: string | null; valueProp: string | null; subscriptionStatus: string };
}

/** A persisted observation row — the dedupe ledger + audit trail. */
export interface IntentObservationRow {
  profileUrl: string;
  postRef: string;
  signalKind: "engagement" | "content";
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
  /** upsert an intent-sourced lead (source 'intent'), deduped by profile url; returns its id */
  upsertIntentLead(accountId: string, candidate: ProspectCandidate): Promise<{ leadId: string }>;
  markRulesGate(leadId: string, result: RulesGateResult): Promise<void>;
  saveScore(leadId: string, insights: LeadInsights, qualified: boolean): Promise<void>;
  /** capture the "why now" intent signal on the lead — feeds Surface A's why-now chip */
  saveIntentSignal(leadId: string, accountId: string, signal: { label: string; detail: string }): Promise<void>;
  /** the rule-11 gate: account + lowercased LinkedIn URL lookup against suppression_entries */
  isSuppressed(accountId: string, kind: "linkedin", value: string): Promise<boolean>;
  getLiveCopyAgent(accountId: string): Promise<{ id: string } | null>;
  completeRun(agentId: string, lastRunAt: Date): Promise<void>;
}

export interface IntentScanDeps {
  store: IntentScanStore;
  linkedin: Pick<LinkedInInfra, "searchPosts" | "listProfilePosts" | "listPostEngagers" | "getProfile">;
  classifyFn: (observations: IntentObservationInput[], ctx: IntentContext) => Promise<IntentVerdict[]>;
  rankFn: (candidates: RankCandidate[], ctx: RankContext) => Promise<LeadInsights[]>;
  triggerCopyDraft: (payload: CopyDraftPayload) => Promise<void>;
  now?: () => Date;
}

export interface IntentScanSummary {
  status: "completed" | "skipped";
  reason?: "no_connection" | "empty_watchlist";
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
  account: { industry: string | null; websiteScan: (WebsiteScan & { url?: string }) | null };
  /** recent sent openers — anti-template "do not reuse" list for the draft prompt (0044) */
  avoidPhrases: string[];
  /** openers from THIS account that earned interested replies — Vera's positive memory,
   *  injected as guide-for-angle exemplars (Stage 0.5). Derived at read time, never stored. */
  winningOpeners: string[];
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
  /** when the lead was last AI-ranked; drives refresh-on-release before a delayed email touch */
  scoredAt: Date | null;
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
  // ── self-optimizing loop (Phase 3), inert when no experiment/playbook exists ──
  /** the account's running experiment, or null; loaded once per run */
  getActiveExperiment(accountId: string): Promise<ActiveExperiment | null>;
  /** the account's adopted champion strategy + playbook version; {strategy:{}, version:null} when none */
  getChampion(accountId: string): Promise<{ strategy: CopyStrategy; version: number | null }>;
  /** attribute a lead's outreach to its experiment arm (service-role write) */
  stampLeadExperiment(
    leadId: string,
    experimentId: string,
    variant: "champion" | "challenger"
  ): Promise<void>;
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
}

/** A running experiment as the copy-draft pipeline needs it: id, split, and the challenger strategy. */
export interface ActiveExperiment {
  id: string;
  allocationPct: number;
  challengerStrategy: CopyStrategy;
}

// ── OptimizeStore: the decide pipeline (GATE 0 suggest-only, enterprise-grade-brain spec 2026-07-16) ─
/** A running experiment as the decide pipeline needs it. */
export interface RunningExperiment {
  id: string;
  accountId: string;
  stageKey: FunnelStageKey;
  minSample: number;
  /** the champion strategy this experiment tested against (jsonb on the row) */
  championStrategy: CopyStrategy;
  /** the challenger strategy under test (jsonb on the row) — canary detection compares it to the champion */
  challengerStrategy: CopyStrategy;
  /**
   * Alpha-investing wealth spent to run THIS experiment (Task 7 / WS-1.1, migration 0058's
   * `alpha_spent`). Null = a pre-2A row (honest unknown, never backfilled) — `decideExperimentV2`
   * self-clamps an `undefined` alpha option to its own default (0.05), so the pipeline passes
   * `exp.alphaSpent ?? undefined` straight through rather than special-casing null itself.
   */
  alphaSpent: number | null;
}

/** A new experiment the autonomous loop chains after a conclusion. */
export interface StartExperimentInput {
  accountId: string;
  stageKey: FunnelStageKey;
  champion: CopyStrategy;
  challenger: CopyStrategy;
  /**
   * Alpha-investing spend for this experiment (Task 7 / WS-1.1) — always a concrete number here:
   * the caller (chainNext) only reaches `startExperiment` after `nextAlphaSpend` returned non-null
   * (a null spend means the chain PAUSES and never calls this at all). Debited from the account's
   * `optimization_playbook.alpha_wealth` in the same transaction as the insert (pg-store.ts).
   */
  alphaSpent: number;
}

export interface OptimizeStore {
  /** all running experiments across accounts (service-role scan) */
  getRunningExperiments(): Promise<RunningExperiment[]>;
  /** per-lead outcome flags for one arm of an experiment */
  getArmFlags(experimentId: string, variant: "champion" | "challenger"): Promise<LeadOutcomeFlags[]>;
  /**
   * Conclude an experiment (discarded / halted) with the decision reason.
   *
   * Task 7 / WS-1.1: a decisive conclusion credits alpha-investing wealth back (see pg-store.ts).
   * `opts.credit` (default true) lets a caller mark the conclusion ADMINISTRATIVE — the
   * identical-arm heal path passes `{ credit: false }` because freeing a stuck slot is cleanup,
   * not a statistical conclusion (and heals typically close UNFUNDED manual experiments, so
   * crediting them would mint wealth that was never spent). Halts never credit regardless of this
   * flag (the status guard in pg-store.ts).
   */
  concludeExperiment(
    id: string,
    status: ExperimentStatus,
    reason: string,
    opts?: { credit?: boolean }
  ): Promise<void>;
  /**
   * Adopt a proven challenger autonomously: playbook champion ← challenger_strategy
   * (version-bumped), experiment → 'adopted' with the decision reason. Returns the NEW
   * champion strategy so the loop can chain the next test against it — or `null` if the claim
   * failed (see below), in which case the caller must write nothing and skip chaining for this
   * experiment.
   *
   * GATE 0 (enterprise-grade-brain spec, 2026-07-16): the decide loop no longer calls this — a
   * winning challenger only gets `markReadyToAdopt` below, and the owner's manual adopt action
   * (`apps/web` `adoptExperiment`) applies the win with its own writes. Kept on the interface for
   * GATE 1, when the anytime-valid decision core resumes autonomous adoption.
   *
   * Claim-first ordering (WS-3.2 race-condition fix, 2026-07-18): GATE 1's auto-adopt tick is the
   * first concurrent actor racing the owner's manual dashboard buttons (adopt/discard/revert), all
   * of which act on the same experiment row. The implementation MUST run its status-guarded claim
   * (`ready_to_adopt`/`running` → `adopted`) FIRST, before writing anything else, and only proceed
   * to the playbook write + wealth credit if that claim actually transitioned the row — never write
   * the playbook unconditionally and gate only the credit, or a lost race can still commit the
   * challenger as champion under a row that says something else happened.
   *
   * Task 7 / WS-1.1: also credits alpha-investing wealth on adoption (see pg-store.ts) — reached
   * only on a successful claim, which naturally limits the credit to real adoptions. Since
   * `apps/web`'s `adoptExperiment` bypasses this method entirely (per the GATE 0 note above), that
   * credit is dormant in production today, same as the rest of this method — it activates once
   * GATE 1 (or a wiring of the manual action) actually calls it.
   */
  adoptChallenger(experimentId: string, reason: string): Promise<CopyStrategy | null>;
  /**
   * A winning challenger is MARKED ready_to_adopt (suggest-only surface — the owner's manual
   * adopt action can still apply it any time). No concluded_at: the experiment still occupies the
   * account's one-live slot. GATE 1 / WS-3.2: also stamps `readied_at = now()` — the moment this
   * mark happened — which starts the 24h auto-adopt grace clock `getMatureReadyToAdopt` reads.
   */
  markReadyToAdopt(experimentId: string, reason: string): Promise<void>;
  /**
   * GATE 1 (enterprise-grade-brain spec, WS-3.2): the global `adoption_mode` app-setting —
   * 'auto' enables the grace-period auto-adopt pass in the decide pipeline; 'manual' (the
   * default) keeps today's suggest-only-forever behavior byte-identical. Same
   * appSettings/eq-by-key pattern as `getBestOfN`/`isKillSwitchOn` (pg-store.ts).
   */
  getAdoptionMode(): Promise<"auto" | "manual">;
  /**
   * GATE 1 (enterprise-grade-brain spec, WS-3.2): experiments sitting in `ready_to_adopt` whose
   * `readied_at` is at least `graceMs` in the past — mature enough for the auto-adopt pass to
   * re-verify and (if the verdict still holds) adopt autonomously. Returns the same shape
   * `getRunningExperiments` does; a row with a null `readied_at` (pre-0059, or never marked) is
   * never considered mature.
   */
  getMatureReadyToAdopt(graceMs: number): Promise<RunningExperiment[]>;
  /**
   * Start the chained experiment. Returns false (never throws) when the account already has a
   * live experiment (the one-live unique index) — the loop simply skips chaining then.
   */
  startExperiment(input: StartExperimentInput): Promise<boolean>;
  /**
   * Stage 1b collective prior: every SENT first-touch message with a Stage-1 recipe stamp,
   * ACROSS accounts (service role) — strategy knobs + outcome booleans only, never text.
   */
  getStampedOutcomes(): Promise<{ strategy: CopyStrategy; flags: LeadOutcomeFlags }[]>;
  /** recently concluded experiments for one account (label + status) — generation context so
   *  the recipe generator doesn't re-propose already-tested ideas */
  getRecentConclusions(accountId: string, limit: number): Promise<{ label: string; status: string }[]>;
  /**
   * Live A/A canary (enterprise-grade-brain spec, WS-1.8): the app-setting-pinned account the
   * canary experiment runs on. null when unset — the seeding step is then a no-op.
   */
  getCanaryAccountId(): Promise<string | null>;
  /**
   * Idempotently ensure a running A/A experiment (challenger deep-equal to champion) exists for
   * this account — 50/50 allocation for maximum power. Returns true if it created one, false if
   * the account already has a live experiment (one-live unique index, 23505 swallowed — never
   * throws). The canary occupies the account's single experiment slot by design.
   */
  ensureCanaryExperiment(accountId: string): Promise<boolean>;
  /**
   * The account's alpha-investing wealth (Task 7 / WS-1.1, `optimization_playbook.alpha_wealth`).
   * A missing playbook row means the account has never adopted anything — returns
   * `ALPHA_WEALTH_START` (0.05) in that case rather than throwing or returning null.
   */
  getAlphaWealth(accountId: string): Promise<number>;
  /**
   * Message-shape selector (spec §7): the `bold_shapes_account_ids` app-setting — the accounts
   * pinned to explore the bold shapes (provocation/disqualifier/own_cold) in generation. Same
   * admin-pin pattern as `aa_canary_account_id`, but a LIST (jsonb array of account ids). Empty
   * when unset or malformed ⇒ no account may propose a bold shape (safe subset only, everywhere).
   */
  getBoldShapesAccountIds(): Promise<string[]>;
}

export interface OptimizeDeps {
  store: OptimizeStore;
  /**
   * Stage 1b generate→gate: LLM-proposed candidates for the next challenger (knob-flip baseline
   * always included by the brain). ABSENT ⇒ chaining is the deterministic knob-flip, exactly the
   * pre-1b behavior — guarded by test.
   */
  proposeCandidatesFn?: (input: GenerateRecipesInput) => Promise<CopyStrategy[]>;
  /** RNG for Thompson sampling (injectable for deterministic tests); defaults to Math.random */
  rand?: () => number;
  /**
   * Live A/A canary (WS-1.8): fired when the canary experiment produces a non-`keep_running`
   * verdict — a false signal from the decide gate itself (the arms are identical). Best-effort;
   * absent = no alert (tests, dev). The pure core never touches email — this is the only hook.
   */
  notifyCanaryAlert?: (info: {
    experimentId: string;
    accountId: string;
    decision: string;
    reason: string;
  }) => Promise<void>;
  /**
   * The app-setting-pinned account the live A/A canary is seeded on (the same value the trigger
   * task reads via `getCanaryAccountId()`). Canary semantics (exempt from every action branch,
   * alert-only) apply ONLY when a signature-equal experiment's `accountId` matches this value.
   * null/undefined ⇒ no account is exempt — a signature-equal experiment anywhere is treated as
   * an accidental identical-arm experiment (see the discard-and-free-the-slot path below), never
   * as the canary.
   */
  canaryAccountId?: string | null;
  /**
   * Message-shape selector (spec §7): the accounts pinned into `bold_shapes_account_ids`, read once
   * by the thin trigger. Only a pinned account's generation may propose the bold shapes
   * (provocation/disqualifier/own_cold); everyone else stays on the safe subset. Absent/empty ⇒ no
   * account may propose a bold shape.
   */
  boldShapesAccountIds?: string[];
}

export interface OptimizeSummary {
  evaluated: number;
  /** discarded + halted this tick — conservative conclusions only (GATE 0: adopt no longer concludes) */
  concluded: number;
  /**
   * GATE 0 (enterprise-grade-brain spec, 2026-07-16): stays 0 during the suggest-only window — the
   * decide loop no longer adopts on its own. Returns to counting real adoptions at GATE 1.
   */
  adopted: number;
  chained: number;
  /** winning challengers marked ready_to_adopt this tick — suggestions surfaced for the owner */
  readied: number;
  /**
   * A/A canary: decisive verdicts fired on an identical-arm experiment this tick — a calibration
   * failure in the decide gate itself. Alerted, not acted on; never counted in concluded/readied.
   */
  canaryAlerts: number;
  /**
   * Task 7 / WS-1.1: a discard/halt conclusion left the account's alpha-investing wealth below
   * `ALPHA_MIN_SPEND` — the chain paused (no next experiment launched) rather than spend a
   * de-minimis alpha. Distinct from `chained` (which only counts an experiment actually started)
   * and from a `startExperiment` one-live conflict (neither chained nor chainPaused — a real
   * experiment is already occupying the slot, nothing to pause).
   */
  chainPaused: number;
  /**
   * GATE 1 (enterprise-grade-brain spec, WS-3.2): mature `ready_to_adopt` experiments (readied_at
   * at least `GRACE_MS` in the past) that STILL cleared re-verification and were adopted
   * autonomously this tick. Config-gated: stays 0 whenever `adoption_mode` is 'manual' (the
   * default) — the auto-adopt pass never even runs then. Distinct from `adopted` (which GATE 0
   * hardwired to 0 and GATE 1 leaves untouched — the ordinary per-tick loop still only suggests).
   */
  autoAdopted: number;
}

export interface CopyDraftDeps {
  store: CopyDraftStore;
  draftLinkedInFn: (input: DraftInput) => Promise<LinkedInDraft>;
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
   * signal-justified SAFE shape per lead. Never affects the challenger arm.
   */
  messageShapeAuto?: boolean;
}

export interface CopyDraftSummary {
  status: "completed" | "skipped";
  drafted: number;
  suppressed: number;
  skipped: number;
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
  lead: { linkedinUrl: string | null };
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
}

/** One of a tenant's connected LinkedIn sender accounts, with its current safety state.
 *  Extends the invite-selector's SenderCandidate with today's message count so the
 *  dispatcher can budget invites and messages per account independently (rule 04). */
export interface DispatchSender extends SenderCandidate {
  /** Messages this account has already sent today (its own message cap is independent). */
  sentTodayMessages: number;
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
  }): Promise<{ id: string; created: boolean }>;
  setReplyClassification(replyId: string, verdict: ReplyVerdict): Promise<void>;
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
   */
  reviveSequenceRun(leadId: string, nextActionAt: Date): Promise<void>;
  /**
   * Inputs for an ACTIVE contextual reply (the "converse to close" step): the live Outreach agent's
   * grounding + send mode + the running thread for this lead. Returns null when there's no live
   * Outreach agent or the lead has no insights to ground a reply — the responder then stays silent
   * and the inbound reply is merely classified + the user notified (the prior behavior).
   */
  getResponderBundle(accountId: string, leadId: string, campaignId: string | null): Promise<ResponderBundle | null>;
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
  /** prior messages in the thread, oldest first (excludes the incoming one) */
  thread: ConversationTurn[];
  /** prior agent messages actually sent in this thread — drives the converse-to-close turn cap */
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
  /** the lead's experiment-arm stamp (0040, lead-level) — carried onto every conversation
   *  send's recipe so message-level attribution never loses the arm (Stage 1) */
  attribution: {
    experimentId: string | null;
    variant: "champion" | "challenger" | null;
    /** the strategy that shaped THIS message: the challenger strategy only while the lead's own
     *  experiment is still the account's LIVE one; otherwise the current champion (WS-3.1). */
    strategy: CopyStrategy;
    /** optimization_playbook.version at bundle-build time (null = no playbook adopted yet) */
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

# Conversation Intelligence Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Give the Outreach agent a per-lead conversation state, a move policy bounded by researched rules, a composer that writes only the chosen move, and a learner over logged decisions — behind an `app_settings` knob that is byte-identical to today when off.

**Architecture:** Pure brain modules in `packages/agent-brains/src/conversation/` (state, reader, rules, policy, priors, composer, learner, timing, sim). One pipeline core `packages/jobs/src/pipeline/conversation-decide.ts` runs reader→rules→policy→composer for all three triggers (reply, first message after acceptance, proactive follow-up), logs every decision to `conversation_decisions`, and is called by `inbound.ts`, `sequence-touch.ts`, and the new `first-message.ts`. A nightly `conversation-learn` rolls decisions into per-account and global prior tables that the policy reads. Rollout: `conversation_policy` knob `off → shadow → live_replies → live`.

**Tech Stack:** TypeScript strict, zod, Vercel AI SDK (`generateObject`, `MockLanguageModelV3` from `ai/test`), Drizzle + Supabase Postgres (migration 0074), Trigger.dev v4 tasks, vitest, `packages/evals` (tsx).

**Spec:** `docs/superpowers/specs/2026-10-27-conversation-intelligence-design.md` (cites `docs/superpowers/research/2026-10-27-sales-conversation-research.md` as `[R …]`).

## Global Constraints

- Rule 13: brains import no Trigger/drizzle/db (`packages/agent-brains/src/purity.test.ts`); every LLM call takes `model: LanguageModel = getModel()`; trigger files < 80 lines and import a core from `../pipeline/` (`packages/jobs/src/structure.test.ts`).
- Rule 02/11: every new table has `account_id … on delete cascade` + `enable row level security` + `is_account_member` select policy in the same migration; service-role writes only; `retention(<table>)` note for prospect-data tables; new tables added to `packages/db/src/schema.test.ts` lists. The one global table has **no** policies and only numeric/enum columns.
- Rule 04: no new LinkedIn reads. Rule 11: suppression is checked before every send (unchanged) and written only per spec §6.4.
- White-label: no vendor or sales-method names in UI/help/copilot ("Challenger", "Sandler", "SPIN", "Unipile" never appear). Help articles ship in the same PR (rule 09).
- Knob off ⇒ byte-identical behaviour: every routing task has a test asserting the legacy path when `mode === "off"`.
- Exact values from the spec: move vocabulary (15 moves, §6.1); length bands `one_line ≤120`, `short ≤240`, `standard ≤320` chars; question budget 5; labels 1; follow-ups without reply max 2 then `breakup`; `propose_times` only with `explicitPositive`; suppression on `explicitOptOut` or `stance=negative ∧ confidence ≥ 0.8 ∧ intent=declines`; reply delay floor 4 min / ceiling 3 h; quiet window 21:00–07:00 local; reward table §7.3; cell counts as real only at `n ≥ 5`; archetype = seniority{ic_mgr,dir_vp,cxo_founder} × skepticism{low,high,unknown} × directness{low,high,unknown}; phases {pre_reply, engaged, exploring, asked, after_no}; exploration never picks `propose_times`, `reframe`, `poke`; `RESPOND_MAX_REPLY_AGE_MS` (72 h) stays the freshness window.
- Branch `feat/conversation-intelligence` (worktree `/Users/aidenrigali/Vantera-convo`), based on main at `7ab98ec3` (PR #83 merged: `native_messages`, `thread-sync` exist). Next migration number: **0074**.

## Review Focus

1. A reply in another language (e.g. Spanish "Gracias, ¿de qué se trata?") — reader must still yield `stance=neutral`, `intent=asks_question`; composer answers in that language. → Task 3 test `reads a non-English reply`.
2. An emoji-only or empty-text reply ("👍") — `intent=small_talk`, `stance=neutral`, never `opt_out`; policy may `wait`. → Task 3 test `an emoji-only reply is small talk`, Task 11 test `wait is a legal answer to small talk`.
3. Two prospect messages arriving before any answer — `syncState` reads both in order, one decision, one send. → Task 11 test `a double-message is read as two turns and answered once`.
4. A draft the user edited in Approvals before sending — recipe keeps `move`, decision is marked off-policy and excluded from learning. → Task 17 test `edited sends are excluded from rollup`.
5. "Are you a bot?" — `identitySuspicion=true` ⇒ `hand_to_human`, no draft, one `needs_human` notification, never a reply arguing humanity. → Task 2 test `identity suspicion leaves only hand_to_human`, Task 11 test `identity suspicion hands off`.

---

## Shared interfaces (defined once; later tasks use these names verbatim)

```ts
// packages/agent-brains/src/conversation/state.ts
export type Trait = { value: number; confidence: number } | null;
export type Stage = "pre_contact"|"invited"|"connected"|"opened"|"engaged"|"exploring"|"qualified"|"asked"|"booked"|"declined"|"dormant"|"handed_off"|"closed";
export type Phase = "pre_reply"|"engaged"|"exploring"|"asked"|"after_no";
export type Archetype = `${"ic_mgr"|"dir_vp"|"cxo_founder"}:${"low"|"high"|"unknown"}:${"low"|"high"|"unknown"}`;
export type ConversationState = z.infer<typeof conversationStateSchema>;   // spec §5, v:1
/** one stored message of the thread; "human" = the seller typed it natively (native_messages) */
export type StoredTurn = { ref: string; role: "agent"|"lead"|"human"; text: string; at: string; stage?: "invite"|"message"; hook?: string|null };

// packages/agent-brains/src/conversation/read.ts
export type Readout = z.infer<typeof readoutSchema>;                        // spec §5 readout shape

// packages/agent-brains/src/conversation/moves.ts
export const MOVES = ["answer","acknowledge","observe","ask_discovery","poke","reframe","narrow","offer_value","soft_ask","propose_times","confirm","graceful_exit","breakup","wait","hand_to_human"] as const;
export type Move = (typeof MOVES)[number];
export type LengthBand = "one_line"|"short"|"standard";
export const LENGTH_BAND_CHARS: Record<LengthBand, number> = { one_line: 120, short: 240, standard: 320 };
export type LinkKind = "none"|"website"|"content"|"booking";
export type Style = { lengthBand: LengthBand; question: boolean; link: LinkKind; mirror: boolean };
export type Trigger = "reply"|"first_message"|"followup";
export type MoveDecision = { move: Move; style: Style; rationale: string; propensity: number; shortlist: { move: Move; style: Style; rationale: string }[] };

// packages/agent-brains/src/conversation/priors.ts
export type Level = "move"|"move_phase"|"move_phase_archetype";
export type PriorSource = "research"|"sim"|"real";
export type PriorCell = { level: Level; move: Move; phase: Phase|""; archetype: Archetype|""; source: PriorSource; n: number; positives: number; rewardSum: number; rewardSq: number };
export type PriorTable = PriorCell[];

// packages/jobs/src/pipeline/conversation-decide.ts
export type ConversationMode = "off"|"shadow"|"live_replies"|"live";
export type ConversationTrigger =
  | { kind: "reply"; replyId: string; incoming: string; receivedAt: Date; readout: Readout }
  | { kind: "first_message" }
  | { kind: "followup"; runId: string; touchNo: number; isLast: boolean };
export type DecideOutcome = { action: "drafted"|"wait"|"hand_to_human"|"exit"|"skipped"; decisionId: string|null; move: Move|null; reason?: string };
```

---

## Part 1 — Pure brain modules (`packages/agent-brains`)

### Task 1: Conversation state — schema, seeding, stage derivation, rendering

**Files:**
- Create: `packages/agent-brains/src/conversation/state.ts`
- Test: `packages/agent-brains/src/conversation/state.test.ts`

**Interfaces:**
- Produces: `conversationStateSchema`, `ConversationState`, `Stage`, `Phase`, `Archetype`, `StoredTurn`, `Trait`,
  `emptyState(): ConversationState`, `seedState(lead: CopyLead, insights: StoredInsights | null): ConversationState`,
  `deriveStage(state): Stage`, `phaseOf(stage: Stage): Phase`, `archetypeOf(person: ConversationState["person"]): Archetype`,
  `renderState(state): string` (≤ 2800 chars), `STATE_VERSION = 1`.

- [ ] **Step 1: Write the failing tests**

```ts
it("emptyState parses against the schema with stage pre_contact", () => {
  expect(conversationStateSchema.parse(emptyState()).stage).toBe("pre_contact");
});
it("seedState infers seniority from the title and nothing else", () => {
  const s = seedState({ firstName: "A", lastName: "B", title: "Chief Revenue Officer", companyName: "X", industry: null }, null);
  expect(s.person.seniority).toBe("cxo");
  expect(s.person.skepticism).toBeNull();
});
it("seedState flags a likely reverse-seller from the headline at low confidence", () => {
  const s = seedState({ ...lead, title: "Helping founders grow | Business Development @ Agency" }, null);
  expect(s.person.role).toBe("seller_to_us");
  expect(s.person.notes).toContain("headline reads like a service provider");
});
it.each([
  [{ counters: { agentTurns: 1, leadTurns: 0 }, memory: {} }, "opened"],
  [{ counters: { agentTurns: 1, leadTurns: 1 }, memory: {} }, "engaged"],
  [{ counters: { agentTurns: 1, leadTurns: 1 }, memory: { problemsStated: ["pipeline"] } }, "exploring"],
  [{ counters: { agentTurns: 2, leadTurns: 1, asksMade: 1 }, memory: { problemsStated: ["pipeline"] } }, "asked"],
  [{ memory: { explicitOptOut: true } }, "declined"],
])("deriveStage is a pure function of memory + counters: %j → %s", (patch, stage) => {
  expect(deriveStage(withPatch(emptyState(), patch))).toBe(stage);
});
it("phaseOf collapses 13 stages to 5 phases", () => {
  expect(phaseOf("connected")).toBe("pre_reply"); expect(phaseOf("qualified")).toBe("exploring"); expect(phaseOf("declined")).toBe("after_no");
});
it("archetypeOf buckets seniority × skepticism × directness, unknown when confidence < 0.5", () => {
  expect(archetypeOf({ ...person, seniority: "vp", skepticism: { value: 0.9, confidence: 0.8 }, directness: { value: 0.2, confidence: 0.3 } })).toBe("dir_vp:high:unknown");
});
it("renderState stays under 2800 chars with 6 notes, 10 hooks and 5 questions", () => { … });
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `pnpm --filter @vantera/agent-brains test -- conversation/state`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement `state.ts`**

Schema exactly per spec §5 (`v: z.literal(1)`, `stage`, `person`, `memory`, `qualification`, `counters`, `lastMove`, `lastLeadMessageAt`, `lastAgentMessageAt`). `seedState`: seniority from title keywords (`chief|cxo|ceo|cfo|cto|cro|coo → cxo`, `founder|co-founder|owner → founder`, `vp|vice president|head of → vp`, `director → director`, `manager → manager`, else `ic`/`unknown`); `role = seller_to_us` with note when the headline matches `/helping|we help|agency|growth partner|business development|lead gen/i`, `recruiter` on `/recruit|talent acquisition/i`. `deriveStage` precedence: `explicitOptOut|declined-by-reader → declined`; `booked`; `handed_off`; `asked` when `asksMade>0 && lastMove ∈ {soft_ask,propose_times}` and no lead turn after; `qualified` when `painIdentified && authority !== "none"`; `exploring` when `problemsStated.length>0 || prioritiesStated.length>0`; `engaged` when `leadTurns>0`; `opened` when `agentTurns>0`; `connected`/`invited`/`pre_contact` from a `connection` field `{invited: boolean; connected: boolean}` added to counters. `dormant` when `followupsSinceLastReply ≥ 3`.

- [ ] **Step 4: Run tests to verify they pass**

Run: `pnpm --filter @vantera/agent-brains test -- conversation/state`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add packages/agent-brains/src/conversation/state.ts packages/agent-brains/src/conversation/state.test.ts
git commit -m "feat(conversation): per-lead conversation state schema, seeding and stage derivation"
```

### Task 2: Moves and hard rules

**Files:**
- Create: `packages/agent-brains/src/conversation/moves.ts`, `packages/agent-brains/src/conversation/rules.ts`
- Test: `packages/agent-brains/src/conversation/rules.test.ts`

**Interfaces:**
- Consumes: Task 1 types.
- Produces: `MOVES`, `Move`, `Style`, `LengthBand`, `LENGTH_BAND_CHARS`, `LinkKind`, `Trigger`, `MoveDecision`, `styleKey(style: Style): string` (`"short|q|none|m"` form), `MOVE_DEFINITIONS: Record<Move, string>` (one line each, plain words, no method names);
  `type Veto = { move: Move; rule: string; source: string }`;
  `legalMoves(input: { state: ConversationState; trigger: Trigger; readout?: Readout; isLastTouch?: boolean; links: { booking: boolean; website: boolean; content: boolean } }): { legal: Move[]; vetoes: Veto[] }`;
  `EXPLORE_SAFE: ReadonlySet<Move>` (all moves except `propose_times`, `reframe`, `poke`);
  `pitchPattern(sellerName: string | null): RegExp`;
  `mirrorAllowed(state: ConversationState): boolean` (true only for the first two agent turns after the latest lead turn — `[R rule 22]`; the policy sets `style.mirror=false` otherwise).

- [ ] **Step 1: Write the failing tests** (each rule from spec §6.1/§6.2, one `it` per rule; representative set)

```ts
it("propose_times is vetoed without explicitPositive (R rule 6)", () => {
  const { legal, vetoes } = legalMoves({ state: exploring(), trigger: "reply", readout: neutral(), links: all });
  expect(legal).not.toContain("propose_times");
  expect(vetoes).toContainEqual({ move: "propose_times", rule: "needs-explicit-positive", source: "R rule 6" });
});
it("ask_discovery is vetoed once the 5-question budget is spent (R rule 24)", …);
it("acknowledge is vetoed after one label in the thread (R rule 23)", …);
it("a follow-up with 2 unanswered follow-ups leaves only breakup and wait (R rule 14)", () => {
  const r = legalMoves({ state: withCounters({ followupsSinceLastReply: 2 }), trigger: "followup", links: all });
  expect(r.legal.sort()).toEqual(["breakup", "wait"]);
});
it("on the last allowed touch, breakup is the only proactive move", () => { … isLastTouch: true … expect(r.legal).toEqual(["breakup","wait"]) });
it("a seller_to_us role (confidence ≥ 0.6) leaves answer, graceful_exit, hand_to_human", …);
it("identity suspicion leaves only hand_to_human", () => {
  const r = legalMoves({ state: engaged(), trigger: "reply", readout: { ...neutral(), identitySuspicion: true }, links: all });
  expect(r.legal).toEqual(["hand_to_human"]);
});
it("skeptical stance narrows to answer, acknowledge, poke, observe, graceful_exit (spec §6.4)", …);
it("a high-confidence decline leaves graceful_exit and hand_to_human; graceful_exit only once (lastMove guard)", …);
it("the same move kind twice in a row is vetoed", …);
it("reframe is vetoed for ic seniority", …);
it("offer_value needs a content link not yet shared", …);
it("first_message trigger: legal = observe, ask_discovery (and wait); never soft_ask", …);
it("EXPLORE_SAFE excludes propose_times, reframe, poke", …);
it("mirrorAllowed is true for the first two agent turns after a lead turn and false after", …);
it("pitchPattern matches the seller name, platform, AI, all-in-one and ROI percentages, case-insensitively", …);
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `pnpm --filter @vantera/agent-brains test -- conversation/rules`
Expected: FAIL.

- [ ] **Step 3: Implement `moves.ts` and `rules.ts`**

`legalMoves` starts from `MOVES`, applies each spec §6.1 "legal when" and §6.2 predicate as a function `(ctx) => Veto | null`, collects vetoes, returns the remainder (`wait` always legal except on a `reply` trigger with `intent=asks_question`, where `wait` is vetoed with rule `"never-leave-a-question-hanging"`). Each veto's `source` is the research tag string from the spec.

- [ ] **Step 4: Run tests to verify they pass**

Run: `pnpm --filter @vantera/agent-brains test -- conversation/rules`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add packages/agent-brains/src/conversation/moves.ts packages/agent-brains/src/conversation/rules.ts packages/agent-brains/src/conversation/rules.test.ts
git commit -m "feat(conversation): move vocabulary and deterministic hard rules"
```

### Task 3: Reader — structured read of each turn

**Files:**
- Create: `packages/agent-brains/src/conversation/read.ts`
- Test: `packages/agent-brains/src/conversation/read.test.ts`

**Interfaces:**
- Consumes: Task 1.
- Produces: `readoutSchema` (spec §5: `stance`, `confidence`, `intent`, `explicitOptOut`, `identitySuspicion`, `booked`, `answeredQuestionRef`, `newProblems`, `newPriorities`, `newObjection`, `personDelta`, `hookUsed` (for seller turns: `{kind, text}|null`), `questionAsked: string|null`, `claims: string[]`, `linksShared: LinkKind[]`), `Readout`,
  `READ_SYSTEM: RegisteredPrompt` (`registerPrompt("conversation/read", …)`),
  `readTurn(state: ConversationState, turn: StoredTurn, grounding: string, model?: LanguageModel): Promise<Readout>`,
  `applyReadout(state: ConversationState, turn: StoredTurn, readout: Readout): ConversationState` (pure reducer; updates memory/counters/person with confidence-weighted averaging, sets `lastLeadMessageAt`/`lastAgentMessageAt`, re-derives `stage`),
  `isSellerTurn(turn): boolean` (`agent`|`human`).

- [ ] **Step 1: Write the failing tests** (mock model via `MockLanguageModelV3` as in `reply/respond.test.ts`)

```ts
it("a lead turn's readout is parsed and the prompt carries the compact state and the turn text", …);
it("reads a non-English reply: stance neutral, intent asks_question", …);          // Review Focus 1
it("an emoji-only reply is small talk, never opt_out", …);                           // Review Focus 2
it("applyReadout: a seller turn records hookUsed, questionAsked, claims, links; bumps agentTurns only for role=agent", …);
it("applyReadout: a lead turn with answeredQuestionRef marks that question answered", …);
it("applyReadout: explicitOptOut flips stage to declined", …);
it("applyReadout: personDelta averages traits weighted by confidence and never exceeds 6 notes", …);
it("applyReadout: a human (native) turn counts as seller side but not an agent turn", …);
it("preClassify opt-out regexes force explicitOptOut=true regardless of the model (deterministic floor)", …);
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `pnpm --filter @vantera/agent-brains test -- conversation/read`
Expected: FAIL.

- [ ] **Step 3: Implement `read.ts`**

`readTurn` calls `generateObject({ model, schema: readoutSchema, system: READ_SYSTEM.text, prompt: [renderState(state), "Grounding:", grounding, "Turn:", role, text].join("\n"), maxOutputTokens: 600 })`; seller turns use a reduced instruction ("record what this message used/asked/claimed/linked"); after generation OR `preClassify(turn.text)?.classification === "unsubscribe"` into `explicitOptOut` and `stance="opt_out"`. Prompt rules: traits only from how they write; tentative; `identitySuspicion` only on explicit wording; `booked` only on a confirmed specific time.

- [ ] **Step 4: Run tests to verify they pass**

Run: `pnpm --filter @vantera/agent-brains test -- conversation/read`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add packages/agent-brains/src/conversation/read.ts packages/agent-brains/src/conversation/read.test.ts
git commit -m "feat(conversation): reader brain and state reducer"
```

### Task 4: Priors and learner arithmetic

**Files:**
- Create: `packages/agent-brains/src/conversation/priors.ts`, `packages/agent-brains/src/conversation/learn.ts`
- Test: `packages/agent-brains/src/conversation/priors.test.ts`, `packages/agent-brains/src/conversation/learn.test.ts`

**Interfaces:**
- Produces (priors): `Level`, `PriorSource`, `PriorCell`, `PriorTable`, `researchPriors(): PriorTable` (level `move_phase`, source `research`, encoded as `n = α+β`, `positives = α`; values: at `pre_reply` observe 6/10, ask_discovery 6/10, soft_ask 3/10, propose_times 1/10, offer_value 4/10; at `engaged` answer 7/10, acknowledge 5/10, ask_discovery 6/10, soft_ask 3/10; at `exploring` observe 6/10, ask_discovery 5/10, offer_value 5/10, soft_ask 5/10, propose_times 2/10; at `asked` wait 6/10, offer_value 5/10, breakup 4/10; at `after_no` graceful_exit 8/10, poke 3/10, wait 7/10; unlisted = 5/10),
  `MIN_REAL_N = 5`, `posteriorFor(table: PriorTable, move: Move, phase: Phase, archetype: Archetype): { alpha: number; beta: number; n: number; level: Level; source: PriorSource }` (finest level with real `n ≥ MIN_REAL_N`, else next level up, else research; sim rows count at half weight; account rows are passed already merged ahead of global rows), `thompsonPick(candidates: Move[], posteriors: Map<Move, {alpha:number;beta:number}>, rng: () => number, samples = 200): { index: number; propensity: number }`.
- Produces (learn): `DecisionOutcome` (`{ replied; stance: Readout["stance"]|null; furtherLeadTurns; booked; optOut; identitySuspicion; humanTakeover; waitThenReply }`), `REWARD` const (spec §7.3 values), `reward(outcome: DecisionOutcome, move: Move): number`, `isPositive(r: number): boolean` (`r > 0`), `IPW_CLIP = 10`, `updateCell(cell: PriorCell, r: number, propensity: number): PriorCell` (weight `min(1/propensity, IPW_CLIP)`), `rollup(decisions: { move; phase; archetype; propensity; reward }[], source: PriorSource): PriorTable` (emits all three levels).

- [ ] **Step 1: Write the failing tests**

```ts
it("researchPriors gives propose_times at pre_reply a 0.1 mean and observe 0.6", …);
it("posteriorFor falls back move_phase_archetype → move_phase → move → research by MIN_REAL_N", …);
it("sim rows weigh half of real rows in the posterior", …);
it("thompsonPick with a seeded rng is deterministic and propensity sums to 1 over candidates", …);
it("reward: meeting booked dominates (+10) and opt-out is −5; identity suspicion −4; wait followed by reply +1", …);
it("updateCell applies inverse-propensity weight clipped at 10", …);
it("rollup produces move, move_phase and move_phase_archetype cells with consistent totals", …);
```

- [ ] **Step 2: Run tests to verify they fail** — `pnpm --filter @vantera/agent-brains test -- conversation/priors conversation/learn` → FAIL.
- [ ] **Step 3: Implement both modules** (pure arithmetic; Beta sampling via the inverse-CDF-free Marsaglia–Tsang gamma method with the injected `rng`).
- [ ] **Step 4: Run tests to verify they pass** — PASS.
- [ ] **Step 5: Commit** — `git commit -m "feat(conversation): research priors, posterior lookup, Thompson pick and reward arithmetic"`

### Task 5: Policy — shortlist by the model, exploration by the learner

**Files:**
- Create: `packages/agent-brains/src/conversation/policy.ts`
- Test: `packages/agent-brains/src/conversation/policy.test.ts`

**Interfaces:**
- Consumes: Tasks 1, 2, 4.
- Produces: `POLICY_VERSION = 1`, `POLICY_SYSTEM: RegisteredPrompt` (`"conversation/policy"`), `PolicyInput = { state; trigger; readout?; incoming?; legal: Move[]; vetoes: Veto[]; priors: { move: Move; rate: number; n: number; level: Level }[]; links: { booking: boolean; website: boolean; content: boolean }; cta: string }`, `Shortlist = { candidates: { move: Move; style: Style; rationale: string }[] }` (1–3, ranked), `shortlistMoves(input: PolicyInput, model?: LanguageModel): Promise<Shortlist>` (schema-enforced: moves ∈ `legal`, else the candidate is dropped; empty ⇒ `{ candidates: [{ move: "wait", … }] }` when `wait` is legal, else the first legal move),
  `decideMove(shortlist: Shortlist, posteriors: Map<Move,{alpha:number;beta:number}>, rng: () => number): MoveDecision` (top candidate ∉ `EXPLORE_SAFE` ⇒ chosen with propensity 1; otherwise `thompsonPick` over `candidates ∩ EXPLORE_SAFE`).

- [ ] **Step 1: Write the failing tests**

```ts
it("the policy prompt carries the legal menu with definitions, the vetoes, the prior table and the method guide", …);
it("a candidate outside the legal set is dropped; an empty shortlist falls back to wait", …);
it("decideMove never explores into propose_times/reframe/poke: a top-ranked propose_times is chosen with propensity 1", …);
it("decideMove explores among safe candidates with the seeded rng and records the shortlist", …);
it("rationale must cite at least one state fact (a candidate with an empty rationale is dropped)", …);
```

- [ ] **Step 2: Run tests** → FAIL. 
- [ ] **Step 3: Implement `policy.ts`** — `POLICY_SYSTEM` holds the method guide: spec §6.1 move definitions, the spec §3 "go-to responses" rendered as *when/which move* (not scripts), seniority/skepticism guidance from `[R §4]`; explicitly "never name a methodology".
- [ ] **Step 4: Run tests** → PASS.
- [ ] **Step 5: Commit** — `git commit -m "feat(conversation): move policy with bounded exploration"`

### Task 6: Composer and thread-aware lints

**Files:**
- Create: `packages/agent-brains/src/conversation/compose.ts`, `packages/agent-brains/src/conversation/lint.ts`
- Modify: `packages/agent-brains/src/copy/humanizer.ts` (export `BUMP_PHRASES`), `packages/agent-brains/src/index.ts` (export the conversation module surface)
- Test: `packages/agent-brains/src/conversation/compose.test.ts`, `packages/agent-brains/src/conversation/lint.test.ts`

**Interfaces:**
- Consumes: Tasks 1, 2; `ConversationDraft`, `validateConversationMessage`, `generateHumanized`, `leadBlock`, `openerSkeleton`, `findRepeatedOpener`, `normalizeDashes`.
- Produces: `COMPOSE_SYSTEM: RegisteredPrompt` (`"conversation/compose"`), `ComposeInput = { lead: CopyLead; insights: StoredInsights; context: CopyContext; state: ConversationState; thread: ConversationTurn[]; incoming?: string; decision: Pick<MoveDecision,"move"|"style"|"rationale">; avoidSkeletons?: string[]; sellerName: string | null }`,
  `composeMessage(input: ComposeInput, model?: LanguageModel): Promise<ConversationDraft>`, `renderMoveBrief(decision, state): string`,
  `lintForMove(message: string, ctx: { move: Move; style: Style; state: ConversationState; sellerName: string|null; identity: string; avoidSkeletons: string[]; allowedLinks: string[] }): Violation[]` with rules `second-opener`, `hook-reuse`, `pitch-before-exploring`, `bump-phrase`, `too-many-questions`, `question-not-allowed`, `pronoun-balance`, `length-band`, `link-not-allowed`, `label-overuse`.

- [ ] **Step 1: Write the failing lint tests**

```ts
it("flags a second opener whose skeleton matches a hook already used", …);
it("flags a reused hook text (case/punctuation-insensitive)", …);
it("flags the seller name, 'platform', 'AI', 'all-in-one' and 'ROI %' before stage exploring; allows them after", …);
it("flags bump phrases: 'thoughts?', 'following up', 'never heard back', 'circling back', 'bubbling this up'", …);
it("flags >1 question, and any question when style.question=false", …);
it("flags 'we' > 1 or 'I' > 2, and a message with no 'you/your'", …);
it("flags a message over its length band", …);
it("flags a booking link when style.link !== 'booking'", …);
```

- [ ] **Step 2: Write the failing compose tests**

```ts
it("the prompt carries the move brief, the register to mirror, the do-not-say list and the open loop", …);
it("the draft is linted with validateConversationMessage + lintForMove and one bounded regenerate", …);
it("wait and hand_to_human throw (never composed)", …);
it("the champion strategy directives are NOT in the prompt", …);
```

- [ ] **Step 3: Run tests** → FAIL.
- [ ] **Step 4: Implement `lint.ts`, `compose.ts`; export from `index.ts`** — `composeMessage` prompt = `leadBlock` + `renderMoveBrief` + register line (`greeting`, `signoff`, emoji, avg sentence words when `mirror`) + "Already said / asked / claimed / linked (never repeat)" + `renderThread` + incoming; `maxOutputTokens: 300`; validator = `validateConversationMessage(...)` ∪ `lintForMove(...)`.
- [ ] **Step 5: Run tests** → PASS; also `pnpm --filter @vantera/agent-brains test` (purity + single-entry still green).
- [ ] **Step 6: Commit** — `git commit -m "feat(conversation): move-bound composer and thread-aware lints"`

### Task 7: Timing helpers

**Files:**
- Create: `packages/agent-brains/src/conversation/timing.ts`
- Test: `packages/agent-brains/src/conversation/timing.test.ts`

**Interfaces:**
- Produces: `REPLY_DELAY_MIN_MS = 4*60_000`, `REPLY_DELAY_MAX_MS = 3*3_600_000`, `replyDelayMs(theirChars: number, ourChars: number, rng: () => number): number`, `QUIET_START_HOUR = 21`, `QUIET_END_HOUR = 7`, `isQuietHour(now: Date, tz: string): boolean`, `nextQuietExit(now: Date, tz: string): Date`.

- [ ] **Step 1: Tests** — floor/ceiling respected; longer messages ⇒ longer delay (monotone in expectation with fixed rng); `isQuietHour(new Date("2026-10-28T02:30:00Z"), "Europe/Berlin")` true, 10:00 local false; `nextQuietExit` returns 07:00 local.
- [ ] **Step 2: Run** → FAIL. **Step 3: Implement** (log-scaled: `base = 4min + 6min·ln(1 + their/80) + 4min·ln(1 + ours/80)`, jitter ×(0.6..1.6)). **Step 4: Run** → PASS.
- [ ] **Step 5: Commit** — `git commit -m "feat(conversation): human-plausible reply delay and quiet window"`

### Task 8: Note-only first-touch brain

**Files:**
- Create: `packages/agent-brains/src/copy/linkedin-note.ts`
- Modify: `packages/agent-brains/src/index.ts`
- Test: `packages/agent-brains/src/copy/linkedin-note.test.ts`

**Interfaces:**
- Consumes: `DraftInput`, `CONNECTION_NOTE_MAX_CHARS`, `validateLinkedInDraft`'s invite-part lints (`findMissingWhyNow`, grounding checks), `leadIdentity`.
- Produces: `LINKEDIN_NOTE_SYSTEM: RegisteredPrompt` (`"copy/linkedin-note"`), `linkedinNoteSchema = z.object({ connection_note: z.string().max(300) })`, `LinkedInNoteDraft = { connectionNote: string; violations: Violation[] }`, `draftLinkedInNote(input: DraftInput, model?: LanguageModel): Promise<LinkedInNoteDraft>`, `validateLinkedInNote(note: string, grounding: string | null, whyNow: WhyNow | null | undefined, identity: string): Violation[]`.

- [ ] **Step 1: Tests** — note ≤ 200 chars; why-now must be cited (reuse the ML-3 lint); no links/pitch; `LINKEDIN_SYSTEM.hash` unchanged by this file (assert the pair prompt text is untouched); prompt contains the same note rules as the pair prompt (copy the note section verbatim).
- [ ] **Step 2: Run** → FAIL. **Step 3: Implement.** **Step 4: Run** → PASS (incl. `copy/linkedin.test.ts` unchanged).
- [ ] **Step 5: Commit** — `git commit -m "feat(copy): note-only first-touch brain for acceptance-time first messages"`

---

## Part 2 — Persistence and pipeline (`packages/db`, `packages/jobs`)

### Task 9: Migration 0074 — states, decisions, priors, reply readout

**Files:**
- Create: `packages/db/migrations/0074_conversation_intelligence.sql`
- Modify: `packages/db/src/schema.ts` (tables `conversationStates`, `conversationDecisions`, `conversationPriors`, `conversationPriorsGlobal`; `replies.readout`), `packages/db/src/schema.test.ts`

- [ ] **Step 1: Extend the guardrail tests first**

Add `"conversation_states"`, `"conversation_decisions"`, `"conversation_priors"` to the retention list and to the "no client write policies" list; add `"conversation_priors_global"` to `tenantExempt`; add a new `describe("conversation_priors_global is counts only")` asserting the migration's `create table public.conversation_priors_global (` block contains only columns of type `text` (for `level`, `phase`, `archetype`, `move`, `source` — each with a `check (… in (…))`), `integer`, `double precision`, `timestamptz`, and **no** `uuid`/free-text column (text columns must all carry a `check (… in (` constraint).

- [ ] **Step 2: Run** `pnpm --filter @vantera/db test` → FAIL (tables missing).

- [ ] **Step 3: Write the migration**

```sql
-- retention(conversation_states): derived from the lead's thread; cascades with the lead.
create table public.conversation_states (id uuid pk default gen_random_uuid(), account_id uuid not null references public.accounts(id) on delete cascade, lead_id uuid not null, state jsonb not null, last_message_ref text, updated_at timestamptz not null default now(), constraint conversation_states_lead_same_account foreign key (lead_id, account_id) references public.leads(id, account_id) on delete cascade, unique (lead_id));
-- retention(conversation_decisions): per-message decision log; cascades with the lead.
create table public.conversation_decisions (id uuid pk default gen_random_uuid(), account_id …, lead_id uuid not null, scheduled_send_id uuid, decided_at timestamptz not null default now(), mode text not null check (mode in ('shadow','live')), trigger text not null check (trigger in ('reply','first_message','followup')), phase text not null, archetype text not null, move text not null, style_key text not null, propensity double precision not null, seed integer not null, legal_moves jsonb not null, vetoes jsonb not null, state_snapshot jsonb not null, composed_body text, policy_version integer not null, prompt_hash text, outcome jsonb, reward double precision, scored_at timestamptz, constraint conversation_decisions_lead_same_account foreign key (lead_id, account_id) references public.leads(id, account_id) on delete cascade, constraint conversation_decisions_send foreign key (scheduled_send_id, account_id) references public.scheduled_sends(id, account_id) on delete set null);
-- retention(conversation_priors): aggregate counts per account; cascades with the account.
create table public.conversation_priors (account_id …, level text not null check (level in ('move','move_phase','move_phase_archetype')), phase text not null default '', archetype text not null default '', move text not null, n integer not null default 0, positives integer not null default 0, reward_sum double precision not null default 0, reward_sq double precision not null default 0, updated_at timestamptz not null default now(), primary key (account_id, level, phase, archetype, move));
-- GLOBAL (cross-tenant) counts only — no account_id, no ids, no free text (every text column is a checked enum). Service-role only: RLS on, NO policies.
create table public.conversation_priors_global (level text not null check (…), phase text not null default '' check (phase in ('', 'pre_reply','engaged','exploring','asked','after_no')), archetype text not null default '' check (archetype ~ '^$|^(ic_mgr|dir_vp|cxo_founder):(low|high|unknown):(low|high|unknown)$'), move text not null check (move in (…15 moves…)), source text not null check (source in ('research','sim','real')), n integer …, positives …, reward_sum …, reward_sq …, updated_at …, primary key (level, phase, archetype, move, source));
alter table public.replies add column readout jsonb;
-- indexes: conversation_decisions (account_id, decided_at desc), (lead_id), (scored_at) where scored_at is null; RLS + select policies via is_account_member on the three tenant tables.
```

- [ ] **Step 4: Mirror in `schema.ts`** (Drizzle, composite FKs via `foreignKey({...})` as `nativeMessages` does; `replies` gains `readout: jsonb("readout")`).
- [ ] **Step 5: Run** `pnpm --filter @vantera/db test` → PASS. Dispatch the `rls-auditor` subagent on `git diff -- packages/db`; resolve findings.
- [ ] **Step 6: Commit** — `git commit -m "db: 0074 conversation states, decisions, priors (tenant + counts-only global), reply readout"`

### Task 10: Store — `createConversationStore(db)` and the rollout knob

**Files:**
- Modify: `packages/jobs/src/pipeline/pg-store.ts` (new factory at the bottom, after `createThreadSyncStore`), `packages/jobs/src/pipeline/types.ts`
- Test: `packages/jobs/src/pipeline/conversation-store.test.ts` (shape/contract tests with a fake db are not practical; test the pure helpers `mergePriorTables` and `turnsFromRows` exported from a new `packages/jobs/src/pipeline/conversation-store-pure.ts`)

**Interfaces:**
- Produces (in `types.ts`):

```ts
export interface ConversationStore {
  getConversationPolicyMode(): Promise<ConversationMode>;                       // app_settings.conversation_policy, default "off"
  getConversationState(accountId: string, leadId: string): Promise<{ state: ConversationState; lastMessageRef: string | null } | null>;
  saveConversationState(accountId: string, leadId: string, state: ConversationState, lastMessageRef: string | null): Promise<void>;
  /** every stored message in the lead's thread, oldest first: invite+message sends (status sent, ref = scheduled_send id), native_messages (role human), replies (ref = reply id) */
  listThreadTurns(accountId: string, leadId: string): Promise<StoredTurn[]>;
  insertDecision(d: NewDecision): Promise<string>;                               // returns id
  insertScheduledSendReturningId(send: NewScheduledSend & { notBefore?: Date | null }): Promise<string>;
  readPriors(accountId: string): Promise<PriorTable>;                            // account rows first, then global rows
  upsertPriors(accountId: string | null, cells: PriorTable): Promise<void>;      // null = global
  listUnscoredDecisions(olderThan: Date, limit: number): Promise<ScorableDecision[]>;
  scoreDecision(id: string, outcome: DecisionOutcome, reward: number): Promise<void>;
  setReplyReadout(replyId: string, readout: Readout): Promise<void>;
  setReplyOutreachSend(replyId: string, scheduledSendId: string | null): Promise<void>;
  lastDeliveredSendId(accountId: string, leadId: string, before: Date): Promise<string | null>;
  listConnectedWithoutFirstMessage(limit: number): Promise<{ accountId: string; leadId: string; campaignId: string }[]>;
  deferTouch(runId: string, patch: { nextActionAt: Date; lastTouchAt: Date | null }): Promise<void>;  // touches_done - 1
  leadTimezone(leadId: string): Promise<string | null>;                          // timezoneForLocation(lead.location) ?? copy agent's timezone
}
export type NewDecision = { accountId; leadId; scheduledSendId: string|null; mode: "shadow"|"live"; trigger: Trigger; phase: Phase; archetype: Archetype; move: Move; styleKey: string; propensity: number; seed: number; legalMoves: Move[]; vetoes: Veto[]; stateSnapshot: ConversationState; composedBody: string|null; policyVersion: number; promptHash: string|null };
export type ScorableDecision = { id; accountId; leadId; scheduledSendId: string|null; decidedAt: Date; move: Move; phase: Phase; archetype: Archetype; propensity: number; composedBody: string|null; sentBody: string|null; sentAt: Date|null };
```

- [ ] **Step 1: Tests for the pure helpers** — `turnsFromRows` orders by time and maps roles; `mergePriorTables(account, global)` keeps account rows ahead of global.
- [ ] **Step 2: Run** → FAIL. **Step 3: Implement** the store factory + helpers (`listConnectedWithoutFirstMessage`: leads with `linkedin_connected_at not null`, no `scheduled_sends` row with `linkedin_stage='message'` in any non-canceled status, an active `sequence_runs` row, a live copy agent; `getConversationPolicyMode` reads `app_settings.key='conversation_policy'`, only the four literal strings are accepted).
- [ ] **Step 4: Run** `pnpm --filter @vantera/jobs test && pnpm --filter @vantera/jobs type-check` → PASS.
- [ ] **Step 5: Commit** — `git commit -m "feat(jobs): conversation store and conversation_policy knob"`

### Task 11: `conversation-decide.ts` — the one core for all three triggers

**Files:**
- Create: `packages/jobs/src/pipeline/conversation-decide.ts`
- Test: `packages/jobs/src/pipeline/conversation-decide.test.ts`

**Interfaces:**
- Consumes: Tasks 1–7 brain functions; `ResponderBundle`; `ConversationStore`; `InboundStore.insertLeadNotification`, `pauseForHumanTakeover`, `cancelPendingSends`, `stopSequenceForReply`.
- Produces:

```ts
export interface ConversationDecideDeps {
  store: ConversationStore & Pick<InboundStore, "insertLeadNotification"|"cancelPendingSends"|"stopSequenceForReply"|"isSuppressed"|"getLeadLinkedInUrl">;
  readFn: typeof readTurn; shortlistFn: typeof shortlistMoves; composeFn: typeof composeMessage;
  fixFn?: (d: ConversationDraft, i: ComposeInput) => Promise<ConversationDraft>; judgeFn?: JudgeFn; bestOfN?: number;
  now: () => Date; rng: () => number; seed: () => number;
}
export async function syncState(accountId: string, leadId: string, lead: CopyLead, insights: StoredInsights|null, grounding: string, deps: ConversationDecideDeps): Promise<ConversationState>;   // reads every StoredTurn after lastMessageRef, in order; saves; idempotent
export async function runConversationDecide(args: { accountId: string; leadId: string; campaignId: string; trigger: ConversationTrigger; mode: Exclude<ConversationMode,"off">; bundle: ResponderBundle; sellerName: string|null }, deps: ConversationDecideDeps): Promise<DecideOutcome>;
```

Behaviour: `syncState` → `legalMoves` → `readPriors` → `posteriorFor` per legal move → `shortlistMoves` → `decideMove` → if `mode==="shadow"`: insert decision (`scheduledSendId: null`, `composedBody: null`) and return `{ action: "skipped", reason: "shadow" }` without composing; else: `wait` ⇒ decision + `{action:"wait"}`; `hand_to_human` ⇒ decision + `needs_human` notification + `{action:"hand_to_human"}`; `graceful_exit` on a reply ⇒ compose, insert send, `stopSequenceForReply`; otherwise compose (best-of-N + fix as `maybeRespond` does), `cancelPendingSends` for replies, `insertScheduledSendReturningId` with `origin` (`reply_response` for reply, `sequence` otherwise), `notBefore = now + replyDelayMs(...)` for replies, recipe v3 (`move`, `styleKey`, `policyVersion`, `propensity`, `decisionId` — see Task 12 for the recipe change), decision row with the send id; `applyReadout` of the agent turn is left to the next `syncState` (reads the text actually sent).

- [ ] **Step 1: Write the failing tests** (fake store + mock brain fns)

```ts
it("syncState reads unread turns in order and persists lastMessageRef", …);
it("a double-message is read as two turns and answered once", …);                    // Review Focus 3
it("shadow mode logs the decision with no send and composes nothing", …);
it("live: a drafted reply gets origin reply_response, a notBefore ≥ 4 min, recipe v3 with move + decisionId, the booking link tagged via tagLinksInText, and the decision links the send", …);
it("live: wait logs a decision and inserts nothing", …);
it("wait is a legal answer to small talk and is chosen when the shortlist says so", …);
it("identity suspicion hands off: needs_human notification, no draft", …);        // Review Focus 5
it("graceful_exit on a reply stops the sequence", …);
it("followup trigger with isLast=true can only breakup or wait", …);
it("suppressed lead ⇒ skipped before any model call (rule 11)", …);
```

- [ ] **Step 2: Run** → FAIL. **Step 3: Implement.** **Step 4: Run** → PASS.
- [ ] **Step 5: Commit** — `git commit -m "feat(jobs): conversation-decide core (reader → rules → policy → composer → decision log)"`

### Task 12: Recipe v3 and reply attribution

**Files:**
- Modify: `packages/agent-brains/src/optimize/recipe.ts` (`v: 2 | 3`; optional `conversation?: { move: Move; styleKey: string; policyVersion: number; propensity: number; decisionId: string }` input to `buildSendRecipe` ⇒ `v: 3` with those five keys at top level), `packages/jobs/src/pipeline/inbound.ts` (after `insertReply`: `setReplyOutreachSend(replyId, await lastDeliveredSendId(accountId, lead.id, receivedAt))`), `packages/jobs/src/pipeline/types.ts` (`InboundStore` gains the two methods)
- Test: `packages/agent-brains/src/optimize/recipe.test.ts`, `packages/jobs/src/pipeline/inbound.test.ts`

- [ ] **Step 1: Tests** — `buildSendRecipe({brain:"conversation_reply"})` is byte-identical v2 (existing equality tests stay green); with `conversation` ⇒ `v:3` + keys; inbound sets `outreach_send_id` to the last delivered send before `receivedAt` (and null when none).
- [ ] **Step 2: Run** → FAIL. **Step 3: Implement.** **Step 4: Run** → PASS.
- [ ] **Step 5: Commit** — `git commit -m "feat: recipe v3 move stamp and reply→send attribution"`

### Task 13: Inbound — readout-driven actions and routing

**Files:**
- Modify: `packages/jobs/src/pipeline/inbound.ts`, `packages/jobs/src/pipeline/types.ts` (`InboundDeps` gains `conversation?: { mode: ConversationMode; deps: ConversationDecideDeps; sellerName: string|null }`, `InboundStore` gains `setReplyReadout`), `packages/jobs/src/trigger/process-inbound.ts`, `packages/jobs/src/trigger/replay-inbound.ts`, `packages/jobs/src/trigger/thread-sync.ts` (wire `conversation` from `getConversationPolicyMode()` + `createConversationStore`)
- Test: `packages/jobs/src/pipeline/inbound.test.ts`

Behaviour (spec §6.4), applied when `conversation.mode !== "off"`: after `classifyFn`, run `readFn` on the incoming turn (with `syncState` first so the state is current); persist `setReplyReadout`; suppression is written iff `readout.explicitOptOut || (readout.stance === "negative" && readout.confidence >= 0.8 && readout.intent === "declines")`; a negative stance below 0.8 ⇒ `stopSequenceForReply` + `needs_human` ("looked like a no — confirm?") and **no** suppression; `booked`/OOO unchanged. Then: `mode ∈ {live_replies, live}` ⇒ `runConversationDecide({ trigger: { kind:"reply", … } })` replaces `maybeRespond`; `mode === "shadow"` ⇒ `runConversationDecide` (logs) **and** legacy `maybeRespond` runs unchanged; `mode === "off"` ⇒ today's code path, byte-identical (the classifier verdict alone drives suppression).

- [ ] **Step 1: Tests**

```ts
it("mode off: 'I dont.' classified not_interested still suppresses (legacy, unchanged)", …);
it("mode shadow: 'I dont.' with readout skeptical/answers_question is NOT suppressed, the run keeps going, and a shadow decision is logged", …);
it("mode shadow: an explicit 'please remove me' suppresses regardless of the model readout", …);
it("mode shadow: negative stance at confidence 0.6 stops the run, raises needs_human, writes no suppression", …);
it("mode live_replies: the legacy responder is not called; runConversationDecide is", …);
it("the reply row gets its readout persisted", …);
```

- [ ] **Step 2: Run** → FAIL. **Step 3: Implement** (keep `maybeRespond` intact; add the branch). **Step 4: Run** `pnpm --filter @vantera/jobs test` → PASS, including the existing suppression tests.
- [ ] **Step 5: Commit** — `git commit -m "feat(inbound): readout-gated suppression and conversation routing"`

### Task 14: First message at acceptance

**Files:**
- Create: `packages/jobs/src/pipeline/first-message.ts`, `packages/jobs/src/trigger/first-message.ts`
- Modify: `packages/jobs/src/pipeline/copy-draft.ts` (+ `CopyDraftDeps.conversationMode`, `draftLinkedInNoteFn`), `packages/jobs/src/trigger/copy-draft.ts`, `packages/jobs/src/trigger/agent-scheduler.ts` (fire `first-message` every tick), `packages/jobs/src/pipeline/types.ts` (`CopyDraftStore.insertScheduledSend` exists via SequenceTouchStore — add to CopyDraftStore)
- Test: `packages/jobs/src/pipeline/first-message.test.ts`, `packages/jobs/src/pipeline/copy-draft.test.ts`

**Interfaces:**
- Produces: `runFirstMessage(deps: { store: ConversationStore & SequenceTouchStore & Pick<InboundStore,…>; decide: ConversationDecideDeps; mode: ConversationMode; now: () => Date }): Promise<{ scanned: number; drafted: number; waited: number; skipped: number }>` — for each `listConnectedWithoutFirstMessage(50)`: bundle via `getResponderBundle`; skip when `humanHandled` or a lead turn is last; `runConversationDecide({ trigger: { kind: "first_message" }, mode })`. In `copy-draft.ts`: when `conversationMode !== "off"`, draft with `draftLinkedInNoteFn`, lint with `validateLinkedInNote`, insert **only** the invite row (`insertScheduledSend`, not the pair), stamp recipe `brain:"first_touch"`, `promptHash: LINKEDIN_NOTE_SYSTEM.hash`.

- [ ] **Step 1: Tests**

```ts
it("copy-draft mode off: inserts the invite+message pair via the pair brain (unchanged)", …);
it("copy-draft mode shadow/live: inserts only the invite from the note brain; no message row", …);
it("first-message: a connected lead with no message row gets a first_message decision; hooksUsed carries the note's hook", …);
it("first-message: a lead whose invite was canceled 'already connected' gets a first message with no note hook", …);
it("first-message: mode shadow logs only; nothing inserted", …);
it("first-message: skipped when a human handled the thread or the lead spoke last", …);
```

- [ ] **Step 2: Run** → FAIL. **Step 3: Implement.** **Step 4: Run** → PASS; `structure.test.ts` green (new trigger < 80 lines).
- [ ] **Step 5: Commit** — `git commit -m "feat: first message written at acceptance (note-only first touch + first-message scan)"`

### Task 15: Proactive follow-ups through the policy; `wait` returns the touch

**Files:**
- Modify: `packages/jobs/src/pipeline/sequence-touch.ts` (+ `SequenceTouchDeps.conversation?: { mode; deps; sellerName }`), `packages/jobs/src/pipeline/types.ts` (`SequenceTouchOutcome` gains `"deferred"`; `SequenceTouchStore.deferTouch`), `packages/jobs/src/trigger/sequence-touch.ts`
- Test: `packages/jobs/src/pipeline/sequence-touch.test.ts`

Behaviour: `mode === "live"` ⇒ after the existing guards, `runConversationDecide({ trigger: { kind:"followup", runId, touchNo: d.touchNo, isLast: d.touchNo >= <target from config, passed on SequenceTouchDispatch as `isLast: boolean`> }, mode })`; `wait` ⇒ `store.deferTouch(runId, { nextActionAt: now + touchGapDays, lastTouchAt: bundle.lastAgentMessageAt })` and return `"deferred"`; `mode ∈ {shadow, live_replies}` ⇒ log via `runConversationDecide` in shadow then legacy draft; `off` ⇒ unchanged. Add `isLast` to `SequenceTouchDispatch` (computed in `advanceSequence`'s dispatch decision: `touchNo === target`) and pass it through `sequence-orchestrate.ts`.

- [ ] **Step 1: Tests** — off path unchanged (existing tests); live `wait` ⇒ `deferTouch` called with touches returned and outcome `"deferred"`; live drafted ⇒ recipe v3 `brain:"sequence_followup"`; `isLast` reaches the trigger; shadow logs then drafts legacy.
- [ ] **Step 2: Run** → FAIL. **Step 3: Implement.** **Step 4: Run** → PASS.
- [ ] **Step 5: Commit** — `git commit -m "feat(sequence): policy-driven follow-ups; wait returns the touch"`

### Task 16: Dispatch — `notBefore` and the quiet window

**Files:**
- Modify: `packages/jobs/src/pipeline/send-dispatch.ts`, `packages/jobs/src/pipeline/types.ts` (`DispatchableSend.notBefore: Date | null` = `scheduled_for` on an `approved` row; `DispatchableSend.leadTimezone: string | null`), `packages/jobs/src/pipeline/pg-store.ts` (`getDispatchableSends` selects both; `insertScheduledSendReturningId` writes `scheduled_for = notBefore`)
- Test: `packages/jobs/src/pipeline/send-dispatch.test.ts`

Behaviour: an `approved` row with `notBefore > now` is skipped; a `reply_response` row is skipped while `isQuietHour(now, leadTimezone)` (null tz ⇒ no quiet window); `manual` rows are exempt from both.

- [ ] **Step 1: Tests** — three cases above + existing dispatch tests unchanged.
- [ ] **Step 2: Run** → FAIL. **Step 3: Implement.** **Step 4: Run** → PASS.
- [ ] **Step 5: Commit** — `git commit -m "feat(dispatch): honour reply delay and the prospect's quiet hours"`

### Task 17: Learner job — outcomes, rollup, priors

**Files:**
- Create: `packages/jobs/src/pipeline/conversation-learn.ts`, `packages/jobs/src/trigger/conversation-learn.ts`
- Modify: `packages/jobs/src/trigger/agent-scheduler.ts` (fire with a global idempotency key `conversation-learn:<YYYY-MM-DD>`, same pattern as `thread-sync`)
- Test: `packages/jobs/src/pipeline/conversation-learn.test.ts`

**Interfaces:**
- Produces: `MATURITY_MS = 7*86_400_000`, `runConversationLearn(deps: { store: ConversationStore & { outcomeFor(d: ScorableDecision): Promise<DecisionOutcome> }; now: () => Date }): Promise<{ scored: number; excluded: number; cellsAccount: number; cellsGlobal: number }>` — for each `listUnscoredDecisions(now − MATURITY_MS, 500)`: skip (mark scored with `reward: null`, `outcome: { offPolicy: true }`) when `sentBody` is set and `sentBody.trim() !== composedBody?.trim()`; else `outcomeFor` → `reward` → `scoreDecision`; then `rollup` per account (`source: "real"`) → `upsertPriors(accountId, …)` and once more over all (`upsertPriors(null, …)`). `outcomeFor` lives in the store (SQL over replies/readout, native_messages, leads.meeting_booked_at, suppression_entries after `decidedAt`).

- [ ] **Step 1: Tests** — edited sends are excluded from rollup (Review Focus 4); a booked decision rolls into all three levels; decisions younger than 7 days are not scored; global rows carry no account id (the fake store asserts `accountId === null` on the global upsert).
- [ ] **Step 2: Run** → FAIL. **Step 3: Implement.** **Step 4: Run** → PASS.
- [ ] **Step 5: Commit** — `git commit -m "feat(jobs): nightly conversation learner and prior rollups"`

### Task 18: Conversation reliability — thread-sync re-answer test and provider alert

**Files:**
- Create: `packages/jobs/src/pipeline/provider-alert.ts`
- Modify: `packages/jobs/src/pipeline/thread-sync.test.ts`, `packages/jobs/src/trigger/process-inbound.ts` (catch → `classifyProviderError` → `alertOnce`)
- Test: `packages/jobs/src/pipeline/provider-alert.test.ts`

**Interfaces:**
- Produces: `classifyProviderError(err: unknown): "billing"|"auth"|null` (matches `credit balance`, `insufficient`, `invalid x-api-key`, `authentication`), `alertOnce(kind, deps: { store: { getSetting(key): Promise<unknown>; setSetting(key, value): Promise<void> }; send: (alert: { subject: string; body: string }) => Promise<void>; now: () => Date }): Promise<boolean>` keyed `provider_alert:<kind>` with a 24 h cooldown.

- [ ] **Step 1: Tests** — thread-sync: a reply whose first run threw before `setReplyClassification` (row exists, unclassified) is re-answered by `handleLinkedInEvent` on the next sync (assert a `reply_response` send is inserted); provider-alert: billing text classified, alert sent once within 24 h.
- [ ] **Step 2: Run** → FAIL. **Step 3: Implement.** **Step 4: Run** → PASS.
- [ ] **Step 5: Commit** — `git commit -m "fix(reliability): provider billing/auth alert; prove thread-sync re-answers a crashed reply"`

---

## Part 3 — Simulation and evals

### Task 19: Simulated prospects and the sim runner

**Files:**
- Create: `packages/agent-brains/src/conversation/sim/personas.ts`, `sim/prospect.ts`, `sim/judge.ts`, `sim/run.ts`, `packages/agent-brains/scripts/sim-conversation.ts` (tsx), `packages/agent-brains/src/conversation/priors-sim.json` (committed output)
- Modify: `packages/agent-brains/package.json` (script `sim:conversation`)
- Test: `packages/agent-brains/src/conversation/sim/run.test.ts`

**Interfaces:**
- Produces: `PERSONAS: Persona[]` (7: `busy_exec`, `skeptic`, `info_requester`, `reverse_seller`, `warm_operator`, `rude`, `ghost`) with `{ id; seniority; disposition: { replyProbByPhase: Record<Phase, number>; hardCtaPenalty: number; refuses: string[] }; register }` calibrated from `[R §2]` (first-message reply 0.15–0.20, exec ×0.7, hard CTA −0.35), `simulateProspectReply(persona, thread, agentMessage, model): Promise<{ text: string | null; disposition: "unchanged"|"warmer"|"colder" }>` (system rule: tone alone never changes disposition), `judgeSimThread(thread, model): Promise<{ pressure: 1..5; manipulation: 1..5; repetition: 1..5; identityDetection: boolean }>`, `runSimThread(persona, deps: { shortlist; compose; read; rng; model }, maxTurns = 6): Promise<SimThread>`, `simToPriors(threads: SimThread[]): PriorTable` (source `sim`, reward with judge penalties: pressure ≥ 4 ⇒ −3, manipulation ≥ 4 ⇒ −5, identityDetection ⇒ −4).

- [ ] **Step 1: Tests** (mock model) — a `ghost` persona yields no replies; `rude` persona's reply leads to `graceful_exit` then silence; `simToPriors` emits `source: "sim"` only; the runner never calls compose for `wait`.
- [ ] **Step 2: Run** → FAIL. **Step 3: Implement**; run `pnpm --filter @vantera/agent-brains sim:conversation` locally (needs `ANTHROPIC_API_KEY`; 7 personas × 6 seeds) and commit `priors-sim.json` + `packages/evals/fixtures/conversation/sim-*.json` (40 threads, see Task 20 shape). **Step 4: Run tests** → PASS.
- [ ] **Step 5: Commit** — `git commit -m "feat(conversation): simulated prospects, sim runner and sim-seeded priors"`

### Task 20: Multi-turn conversation evals (hard gates)

**Files:**
- Create: `packages/evals/fixtures/conversation/prod-*.json` (5 anonymized production threads — supplied by the owner session before this task; shape below), `packages/evals/src/run-conversation.ts`, `packages/evals/src/graders/conversation.ts`
- Modify: `packages/evals/src/corpus.ts` (`loadConversationCorpus`), `packages/evals/src/ci.ts` (`decide()` gains `conversation: { deterministicPass: boolean; readerFloors: FloorReport[] }`), `packages/evals/src/ci.test.ts`, `.github/workflows/evals.yml` (path `packages/agent-brains/src/conversation/**`)

Fixture shape (six `prod-*.json` files already committed under `packages/evals/fixtures/conversation/`, anonymized by the owner session): `{ id, lead, insights, context, turns: StoredTurn[], expect: { readouts: ({ turn: string } & Partial<Readout>)[] /* one per lead turn, in order */, flaggedTurns: { index: number; rule: string }[] /* historical agent turns the lints MUST flag — these threads are production failures, so a flag is the pass condition */, finalTrigger: Trigger, finalLegal: Move[] /* must all be legal at the end */, finalVetoed: Move[] /* must all be vetoed */, suppression: "none"|"written" }, notes }`.

- [ ] **Step 1: Tests for `graders/conversation.ts`** (no model): `sellerTurnReadout(text: string): Readout` is a deterministic stand-in for seller turns (hook = first sentence, `questionAsked` = the sentence ending in `?`, `linksShared` from URLs, no claims); `gradeConversationCase(case)` walks the turns applying `applyReadout` with the expected readout for lead turns and `sellerTurnReadout` for seller turns, running `lintForMove(turn.text, …)` on each agent turn against the state *before* it, then `legalMoves` at the end with `finalTrigger` (and the last lead readout when the trigger is `reply`); it fails on: any `finalVetoed` move legal, any `finalLegal` move vetoed, suppression decision ≠ expected (the §6.4 predicate over the last lead readout), any `flaggedTurns` entry whose rule was **not** raised on that turn, and any agent turn raising `second-opener`/`pitch-before-exploring` that is not listed in `flaggedTurns`. `ci.test.ts`: `decide()` fails hard when `conversation.deterministicPass === false` or any reader floor fails.
- [ ] **Step 2: Run** → FAIL. **Step 3: Implement** `run-conversation.ts`: `"frozen"` = deterministic grade on expected readouts (hard gate, passRate must be 1); `"live"` = `readTurn` on each lead turn with the real model and floors `stance accuracy ≥ 0.9`, `explicitOptOut recall ≥ 0.95`, `identitySuspicion precision ≥ 0.9` (hard, via `FloorReport`), plus advisory judge `moveFit`/`humanness` on composed drafts.
- [ ] **Step 4: Run** `pnpm --filter @vantera/evals test` → PASS; `pnpm --filter @vantera/evals evals:ci` locally with a key → gates pass.
- [ ] **Step 5: Commit** — `git commit -m "feat(evals): multi-turn conversation gates (rules, suppression, reader floors)"`

---

## Part 4 — Surfaces, help, rollout

### Task 21: Web — move labels, "How Vera reads them", readout metrics

**Files:**
- Modify: `apps/web/src/lib/conversations.ts` (`playLabel` → `turnLabel(recipe)`: `recipe.v === 3` ⇒ `MOVE_LABELS[recipe.move]` plain words; else existing `describeStrategy`), `apps/web/src/app/(app)/prospects/[id]/page.tsx` (read `conversation_states` for the lead; render 3–4 chips + "Where this stands" + open loops; plain functional markup), `apps/web/src/lib/analytics.ts` (positive-reply rate from `replies.readout->>'stance'`, avg lead turns per thread, "asked if bot" count — own account via RLS), `apps/web/src/lib/inbox-intent.ts` (unchanged)
- Create: `apps/web/src/lib/move-labels.ts` (`MOVE_LABELS: Record<Move,string>`, e.g. `ask_discovery: "asked one question"`, `offer_value: "offered something useful"`, `propose_times: "proposed times"`, `wait: "chose to wait"`)
- Test: `apps/web/src/lib/move-labels.test.ts` (every move has a label; no label contains "Challenger|Sandler|SPIN|MEDDIC|bandit|Thompson"), `apps/web/src/lib/conversations.test.ts` (`turnLabel` v3 vs v2)

- [ ] **Step 1: Tests** → FAIL. **Step 2: Implement.** **Step 3:** `pnpm --filter web test && pnpm --filter web type-check` → PASS. Run the `whitelabel-auditor` subagent on `apps/web/src/app/(app)/prospects` + `lib/move-labels.ts`.
- [ ] **Step 4: Commit** — `git commit -m "feat(web): move labels in the inbox, how-Vera-reads-them on the prospect page, conversation metrics"`

### Task 22: Help articles and copilot knowledge

**Files:**
- Modify: `packages/help-content/content/agents-copy.md` (how Vera runs a conversation: reads the person, picks the next move, may wait, hands off when asked if it's a bot or when a thread needs you; never pushes a meeting before you've said yes), `packages/help-content/content/inbox.md` (move labels), `packages/help-content/content/review-queue.md` (a "looked like a no — confirm?" alert)
- Test: `packages/help-content` tests (vendor/method-name lint) stay green.

- [ ] **Step 1:** Edit articles. **Step 2:** `pnpm --filter @vantera/help-content test` → PASS. **Step 3: Commit** — `git commit -m "docs(help): conversation intelligence behaviour"`

### Task 23: Backfill task and rollout runbook

**Files:**
- Create: `packages/jobs/src/pipeline/conversation-backfill.ts`, `packages/jobs/src/trigger/conversation-backfill.ts`, `docs/runbooks/conversation-intelligence-rollout.md`
- Test: `packages/jobs/src/pipeline/conversation-backfill.test.ts`

**Interfaces:**
- Produces: `runConversationBackfill(deps: { store: ConversationStore & { listLeadsWithThreads(limit, after: string|null): Promise<{ accountId; leadId; lead: CopyLead; insights: StoredInsights|null; grounding: string }[]> }; decide: ConversationDecideDeps }): Promise<{ leads: number; turns: number }>` — `syncState` for every lead with any stored turn; idempotent.

Runbook contents: (1) apply 0074 (`supabase db query --linked -f …`), history row; (2) merge + Trigger deploy; (3) run `conversation-backfill`; (4) set `app_settings.conversation_policy = "shadow"`; verification SQL: decisions per day, veto histogram, shadow move vs legacy brain label; (5) after 2 weeks or 200 decisions and evals green ⇒ `"live_replies"`; (6) ⇒ `"live"`; (7) rollback = `"off"`; (8) the seed step for `conversation_priors_global` from `priors-sim.json` happens in the first `conversation-learn` run when the table is empty.

- [ ] **Step 1: Tests** — backfill reads every lead's turns once and resumes by `after` cursor.
- [ ] **Step 2: Run** → FAIL. **Step 3: Implement + write runbook.** **Step 4: Run** → PASS; full gate `pnpm lint && pnpm type-check && pnpm test && pnpm build` → green.
- [ ] **Step 5: Commit** — `git commit -m "feat(jobs): conversation state backfill + rollout runbook"`

---

## Self-review notes

- Spec coverage: §5 → T1/T3; §6.1–6.3 → T2/T5; §6.4 → T13; §6.5 → T7/T16/T15; §7.1 → T6; §7.2 → T8/T14; §7.3–7.4 → T4/T17; §7.5 → T11 (booking-link tag on every composed body) + T12; §7.6 → T9/T11; §8 → T19/T20; §9 → T10 knob + T23 runbook; §10 → T21/T22; §11 → T18.
- Type consistency: `ConversationStore`, `ConversationDecideDeps`, `ConversationTrigger`, `StoredTurn`, `MoveDecision`, `PriorTable` are defined once in the shared block and used verbatim.
- Off-knob byte-identity is asserted in T13, T14, T15, T16.

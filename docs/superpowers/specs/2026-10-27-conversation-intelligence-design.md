# Conversation Intelligence — the Outreach agent's conversation brain v2

- **Date:** 2026-10-27
- **Owner:** Aiden
- **Status:** design, pending owner approval
- **Supersedes:** the "ML-9 Strategy loop" row of `2026-10-21-learning-gate-ml-roadmap.md` and the
  strategy/genome half of `2026-10-17-adaptive-prospecting-closed-loop.md`. Does **not** touch the
  qualification gate (ML-1..8) or the Scout/Intent agents.
- **Research base:** `docs/superpowers/research/2026-10-27-sales-conversation-research.md`
  (cited below as `[R §n]` / `[R rule n]`).

---

## 1. Intent and the why

Vera must run a LinkedIn conversation the way a strong seller does: read the person, decide what
the next **move** is, say only that in their register, and get better from results. Today it
writes messages; it does not conduct conversations.

What production shows (2026-10-27, admin account, 44 sends / 11 replies):

| # | Failure | Evidence | Root cause |
|---|---|---|---|
| 1 | Two cold openers in a row | 43/43 invite+first-message pairs drafted in one shot, same play, both by `first_touch` | The post-accept message is pre-written with the note, as an opener, blind to the note (`copy-draft.ts:308`, `connectionGate`) |
| 2 | Irreversible misreads | "I dont." and "Those are trade secrets!" → `not_interested` → suppression + run stopped (2 of 4 declines were wrong) | A 7-way label drives a compliance write; no stance/confidence |
| 3 | Pitch before pain | 2nd agent message: "Vantera is a LinkedIn outreach tool built for…" after the prospect only described her job | No stage, no "earned the right"; prompt branch "clear buying signal" fires on a warm job description |
| 4 | Content-free turns | "Great to connect! Excited to see what you're working on" | No move vocabulary; "say ONE thing" has nothing to say |
| 5 | Non-buyer not detected | A BD manager reverse-selling was worked as a buyer for 5 turns | No model of who the person is in this conversation |
| 6 | Conversations dropped | 5/5 live replies 10-23..10-25 failed on an AI-credit error; a one-word answer ("CFO") sat 4 days | Failed inbound runs are never re-run; backlog sweep only alerts |
| 7 | AI-slop surface | trigger→consequence hook twice, "I find genuinely interesting", "I'm curious how" | Hook reuse unrecorded; the lint is five phrases `[R §5]` |

The brain's only memory is the rendered transcript (`reply/respond.ts:106`); mid-thread the "play"
reduces to two toggles (`followupLength`, `askStyle` — the other three knobs are suppressed by
`FIRST_TOUCH_ONLY_KNOBS`); nothing records decisions, and nothing learns from conversation outcomes. This spec replaces that with a lead model, a move policy, a composer bound
to the move, and a learning loop over the decisions.

## 2. Goals, non-goals, anti-goals

**Goals**
1. Every outbound message is the **continuation** of a specific thread: it knows what was said,
   by whom, which hooks/claims/questions/links are spent, and where the conversation stands.
2. Vera **reads the person** (directness, formality, warmth, skepticism, seniority, role in this
   conversation) from profile + replies + behaviour, and writes in their register `[R §4]`.
3. Vera **chooses a move**, not a template: the choice is reasoned per lead from a closed,
   learnable move vocabulary with hard rules from proven practice; never a fixed method `[R §1]`.
4. Learning needs **no owner input**: rewards are replies, positive stance, conversation length,
   meetings; negatives are opt-outs, "are you a bot", human takeovers.
5. Cross-customer learning of *which move works for which kind of person at which point* — with
   no prospect data, text, or identity leaving its tenant.
6. Smart on day one (research rulebook + simulated pretraining), sharper automatically as real
   conversations accumulate.
7. Byte-identical behaviour where the policy has nothing to add (fallback = today's brain).

**Non-goals**
- Fine-tuning or RL-training the LLM itself; learning happens over discrete decisions + prompts.
- A manual rating/coaching UI. (Existing Approvals decline-with-reason stays as a weak signal.)
- Email/SMS; changes to Scout/Intent/qualification; the first-touch connection note's content
  model (ML-3 keeps it; this spec changes *when the first message is written*, not the note).
- Replacing the review queue: review/automatic send modes are unchanged.

**Anti-goals (a build that does these has failed even if metrics move)**
- Pushes the meeting: a time ask before an explicit positive signal `[R rule 6]`.
- Manipulates: guilt bumps, false urgency, fake familiarity, assumed pain stated as fact `[R §5]`.
- Invents: any claim/entity not in grounding (existing humanizer invariant).
- Optimizes raw reply rate: bumps and breakups harvest replies and lose meetings `[R rule 25]`.
- Leaks: any cross-tenant pooled row that carries text, ids, or an account.
- Learns pressure from a too-agreeable simulator `[R §6]`.

## 3. Constraints

- Rule 13 skeleton: brain = pure modules in `packages/agent-brains/src/conversation/`, model
  injectable, zod schemas exported; pipeline core pure in `packages/jobs/src/pipeline/`, drizzle
  only in `pg-store.ts`; thin trigger wrappers. Brain purity + single-AI-entry guardrail tests.
- Rule 11: suppression is checked before every send (unchanged) and **written** only as §6.4.
- Rule 04: no new LinkedIn read volume. Timing changes delay sends; they never add reads.
- Rule 02: every new table RLS'd in its migration; service-role writes only; retention cascades
  with the lead. The one global table (§7.4) holds counts only.
- White-label: no vendor or method names on any user surface ("Challenger", "Sandler" never
  appear in UI/help; the copilot may say "asked a discovery question").
- Rollout gate: `app_settings` knob, shadow mode first (§9).
- Attribution: `SendRecipe` v2 is extended, not replaced; `promptHash` keeps changing with prompts.

## 4. Architecture

```
inbound reply / acceptance / nudge-due / first-message-due
        │
        ▼
┌─────────────────────┐   structured read of the new message + profile
│ 1. READER            │──► ConversationState (per lead, persisted, idempotent per message id)
└─────────────────────┘
        │
        ▼
┌─────────────────────┐   state + rulebook + learned priors ─► Move + style + rationale
│ 2. POLICY            │   (hard-rule veto → legal set → LLM choice w/ exploration)
└─────────────────────┘   logs decision (lab_decisions) with propensity
        │
        ▼
┌─────────────────────┐   writes ONLY the chosen move, in the lead's register,
│ 3. COMPOSER          │   thread-aware lints, best-of-N + judge (move-aware rubric)
└─────────────────────┘
        │
        ▼
   conversation_decisions (every decision, incl. wait/shadow) + scheduled_sends.recipe v3 ─► dispatch
        │
        ▼
┌─────────────────────┐   replies/bookings/opt-outs joined to the decision
│ 4. LEARNER           │──► per-account posteriors ⇐ shrink ⇐ global priors (counts only)
└─────────────────────┘   nightly; priors feed step 2
```

The reader and composer are LLM calls; the policy is an LLM call bounded by deterministic rules
and fed by a learned table; the learner is pure arithmetic. Every step is a pure brain module
with an injectable model, so the whole loop runs in tests and in the simulator.

## 5. The lead model (`ConversationState`)

One row per lead in `conversation_states` (jsonb `state`, versioned schema, `account_id`,
`lead_id`, `updated_at`, `last_message_ref`). Rebuilt from scratch by a backfill job (replay all
stored messages through the reader) so it is never the only copy of anything.

```ts
export const conversationStateSchema = z.object({
  v: z.literal(1),
  stage: z.enum([
    "pre_contact", "invited", "connected", "opened",      // we spoke, they haven't
    "engaged",                                           // they replied, nothing substantive
    "exploring",                                         // a problem/priority is on the table
    "qualified",                                         // pain + fit + (some) authority
    "asked",                                             // we proposed next step, awaiting
    "booked", "declined", "dormant", "handed_off", "closed",
  ]),
  person: z.object({
    // 0..1 with confidence; null = unknown. From title/headline, replies, behaviour.
    directness:  trait, formality: trait, warmth: trait, skepticism: trait, verbosity: trait,
    seniority: z.enum(["ic", "manager", "director", "vp", "cxo", "founder", "unknown"]),
    role: z.enum(["buyer", "influencer", "seller_to_us", "gatekeeper", "recruiter", "unknown"]),
    register: z.object({ greeting: z.string().nullable(), signoff: z.string().nullable(),
      emoji: z.boolean(), avgSentenceWords: z.number().nullable(), language: z.string() }),
    notes: z.array(z.string()).max(6),        // "answers in fragments", "asked why we ask"
  }),
  memory: z.object({
    hooksUsed: z.array(z.object({ kind: z.enum(["trigger","pain","observation","proof","reframe"]), text: z.string(), messageRef: z.string() })),
    questionsAsked: z.array(z.object({ text: z.string(), answered: z.boolean(), messageRef: z.string() })),
    claimsMade: z.array(z.string()),
    linksShared: z.object({ booking: z.number(), website: z.number(), content: z.number() }),
    problemsStated: z.array(z.string()),      // in THEIR words
    prioritiesStated: z.array(z.string()),
    objections: z.array(z.object({ kind: z.enum(["dismissive","situational","existing_solution","info_request","what_is_this","not_now","wrong_person"]), text: z.string(), handled: z.boolean() })),
    openLoops: z.array(z.string()),            // things THEY asked that we owe
    commitments: z.array(z.string()),          // things we promised
    explicitPositive: z.boolean(),             // they said yes/open to it (gates time asks)
    explicitOptOut: z.boolean(),
  }),
  qualification: z.object({                    // hidden state, never asked aloud [R §1 MEDDIC]
    painIdentified: z.boolean(), impactStated: z.boolean(),
    authority: z.enum(["decides","influences","none","unknown"]), timing: z.enum(["now","later","never","unknown"]),
  }),
  counters: z.object({
    agentTurns: z.number(), leadTurns: z.number(), questionsBudgetUsed: z.number(),   // ≤5 [R rule 24]
    asksMade: z.number(), followupsSinceLastReply: z.number(), labelsUsed: z.number(), // ≤1 [R rule 23]
  }),
  lastMove: moveRef.nullable(),
  lastLeadMessageAt: z.string().nullable(), lastAgentMessageAt: z.string().nullable(),
});
```
`trait = z.object({ value: z.number().min(0).max(1), confidence: z.number().min(0).max(1) }).nullable()`.

**Reader** (`conversation/read.ts`): `readTurn(state, turn, grounding, model) → { state', readout }`
where `readout` for a lead turn is:

```ts
{ stance: "positive"|"neutral"|"skeptical"|"negative"|"opt_out",
  confidence: 0..1,
  intent: "answers_question"|"asks_question"|"small_talk"|"states_problem"|"objects"|"requests_info"|"agrees_next_step"|"declines"|"opts_out"|"ooo"|"sells_to_us"|"other",
  explicitOptOut: boolean,              // "stop", "don't contact", "unsubscribe", "not interested, please remove"
  identitySuspicion: boolean,           // "is this a bot", "automated?"
  booked: boolean,                      // existing verdict.booked semantics
  answeredQuestionRef: string|null, newProblems: string[], newObjection: {...}|null, personDelta: Partial<person> }
```
The reader runs on **every** stored message (lead replies, agent sends, native human messages), so
hooks/claims/links are recorded from the text actually sent, not from what was planned. Stage is a
pure function of memory + counters (`deriveStage(state)`), never set by the LLM directly.

**Seeding before contact:** `seedState(lead, insights)` fills `person.seniority` from the title,
`role` from headline cues (agency / "helping founders" / recruiter → likely `seller_to_us` or
`recruiter`, low confidence), `register.language`, and nothing else. No profile-text personality
inference beyond seniority: evidence that profile text predicts traits is weak `[R §4]`; traits
come from how they write to us.

## 6. The policy (`conversation/policy.ts`)

### 6.1 Move vocabulary (closed, learnable)

| Move | What it is | Legal when |
|---|---|---|
| `answer` | Answer their question in one plain sentence, no claims | an open loop exists |
| `acknowledge` | Reflect what they said, tentatively ("sounds like…") | lead turn had affect; `labelsUsed < 1` |
| `observe` | Give a useful, checkable observation / peer pattern — earns the right `[R §3.2]` | stage ≥ connected; not twice in a row |
| `ask_discovery` | One easy, answerable question | `questionsBudgetUsed < 5`; last agent move not a question |
| `poke` | Neutral "how do you know…?" about a risk in their current approach `[R §1 Braun]` | existing_solution / "we're fine"; skepticism known |
| `reframe` | One commercial insight that reframes the problem `[R §1 Challenger]` | seniority ≥ director or existing_solution; never to `ic` |
| `narrow` | Either/or that turns "send me info" into discovery `[R §3]` | objection `info_request` unhandled |
| `offer_value` | A specific asset/benchmark they get even if they never buy | stage ≥ engaged; `linksShared.content < 1` |
| `soft_ask` | Interest CTA ("open to…?") | stage ≥ exploring; `asksMade < 2`; no hard ask yet |
| `propose_times` | Specific-time ask with two slots / booking link | `memory.explicitPositive` **only** `[R rule 6]` |
| `confirm` | Confirm a booking / next step, nothing else | stage = asked and they agreed |
| `graceful_exit` | One line, door open, no counter-pitch | stance negative or `declined` |
| `breakup` | Final value + door open, no guilt `[R rule 15]` | `followupsSinceLastReply ≥ 2` |
| `wait` | Say nothing now (silence is a move) | always legal; mandatory within quiet windows |
| `hand_to_human` | Stop and alert | turn cap, `identitySuspicion`, `role ∈ {seller_to_us, recruiter}` with ≥2 turns, low-confidence decline |

Style dimensions chosen with the move: `lengthBand ∈ {one_line, short, standard}` (bands map to
≤120 / ≤240 / ≤320 chars; C-level and `directness>0.7` default to ≤ short `[R §2, §4]`),
`question: boolean` (max one), `link ∈ {none, website, content, booking}`, `mirror: boolean`
(register mirroring on, for the first two agent turns after a reply only `[R rule 22]`).

### 6.2 Hard rules (deterministic, veto before the LLM sees the menu)

Encoded as pure predicates in `conversation/rules.ts`, each tagged with its research source so the
help copilot and the eval report can explain a veto:

1. No pitch words (product name, "platform", "AI", "all-in-one", ROI %) before stage `exploring` `[R rule 4]`.
2. No hook in `hooksUsed` may be reused; no opener skeleton seen in this thread may recur.
3. Exactly ≤1 question per message; none open-ended in the first message `[R rule 3]`.
4. `propose_times` only with `explicitPositive`; `soft_ask` never twice without a lead turn between.
5. Follow-ups without a reply: max 2 then `breakup` then `wait` forever `[R rule 14]`; a follow-up
   must carry new value, never a bump `[R rule 13]`.
6. Never respond to a lead turn with the same move kind twice in a row.
7. `role = seller_to_us|recruiter` with confidence ≥ 0.6 → only `answer`, `graceful_exit`, `hand_to_human`.
8. `identitySuspicion` → `hand_to_human` (never argue humanity).
9. Opt-out / negative with confidence ≥ 0.8 → `graceful_exit` once, then `wait`; §6.4 governs suppression.
10. Quiet windows: no outbound inside the prospect's local 21:00–07:00 (timezone from location;
    unknown → the sender's), nor within `replyDelay(len)` of their message (§6.5).
11. Every assumption in a message is hedged; every claim is in grounding (existing humanizer).
12. `we` ≤ 1, `I` ≤ 2 per message; "you/your" present `[R rule 9]`.

A rule's veto is logged with the decision, so a blocked move is visible in evals and in the
"why this message" readout.

### 6.3 Choice among legal moves

`choose(state, legal, priors, model) → { move, style, rationale, propensity }`:

1. The policy prompt gets: the state (compact), the lead's last message, the legal move menu
   with one-line definitions, and **the prior table** for this `(archetype, stage)` — e.g.
   `observe→ask 0.62 (n=41, global)`, `soft_ask 0.31 (n=9, this account)` as positive-outcome
   rates. It returns a ranked shortlist (≤3) with a rationale that must cite state facts.
2. **Exploration**: the final pick is Thompson sampling over the shortlist using the learner's
   posteriors (§7.3), restricted to the *safe* subset (`propose_times`, `reframe`, `poke` are never
   chosen by exploration, only by the model's top rank). `propensity` = the sampling probability
   of the chosen move, stored for unbiased learning. With no data the posteriors are the research
   priors, so day-one behaviour follows the rulebook with mild variety.
3. Archetype = a coarse bucket of `person` for learning only: `seniority ∈ {ic/mgr, dir/vp, cxo/founder}`
   × `skepticism ∈ {low, high, unknown}` × `directness ∈ {low, high, unknown}` → 27 cells; the LLM
   sees the full continuous state.

### 6.4 Reply understanding replaces the classifier for *actions*

`reply/classify.ts` stays as a signal and for the inbox chip. Actions now key on the readout:

| Readout | Action |
|---|---|
| `explicitOptOut` **or** `stance=negative ∧ confidence ≥ 0.8 ∧ intent=declines` | write suppression (rule 11), stop run, `graceful_exit` once |
| `stance=negative ∧ confidence < 0.8` | stop run, **no suppression**, `hand_to_human` note "looked like a no — confirm?" |
| `stance=skeptical` | legal moves narrow to `answer`, `acknowledge`, `poke`, `observe`, `graceful_exit` |
| `ooo` | unchanged (no action) |
| `booked` | unchanged (`markMeetingBooked`, stand down) |

This closes failure #2: a terse "I dont." is `skeptical/answers_question`, not a decline. The
existing suppression test suite is extended with the misread fixtures.

### 6.5 Timing (content comes first, but these are cheap)

- `replyDelay(len, person)`: minutes, log-scaled with the length of *their* message and of ours,
  jittered; floor 4 min, ceiling 3 h; never seconds `[R rule 16]`. Dispatch's speed lane keeps its
  priority but honours the delay.
- Quiet window (rule 10 above). Follow-up gaps unchanged (`SEQUENCE_DEFAULTS`), but the policy
  may choose `wait` at a due follow-up (a `wait` is logged and learned like any move).
- **`wait` returns the touch.** `advanceSequence` stamps the touch before `sequence-touch` runs,
  so today a skip consumes it; a new `SequenceDecision` kind `deferred` (orchestrator change)
  rolls `touchesDone`/`lastTouchAt` back and re-arms `nextActionAt`. The user's touch count stays
  a **ceiling**; the policy's "2 follow-ups then `breakup`" can only run *below* it, and on the
  final allowed touch `breakup` is the only legal proactive move (so a 2-touch sequence ends with
  a breakup, never with silence it didn't choose). The sequence-builder help copy says so.

## 7. The composer and the learning loop

### 7.1 Composer (`conversation/compose.ts`)
`compose(state, move, style, grounding, model)` replaces the situation-branch prompt in
`reply/respond.ts`. The prompt carries: the move's definition and intent, the register to mirror,
the length band, the explicit **do-not-say** list (`hooksUsed`, `claimsMade`, questions asked,
links shared), what they said in their words, and the open loop to close. The existing
`generateHumanized` → validate → one fix pass stays; `validateConversationMessage` gains
thread-aware lints: second-opener skeleton, hook reuse, pitch words by stage, bump phrases, >1
question, pronoun counts, length band, link not allowed by the move. Best-of-N + judge stay; the
judge rubric adds `moveFit` and `humanness` (reads as a person continuing a thread).
The champion-strategy directives (`strategyDirectives(…, "conversation")`) are **not** injected
into conversation prompts once the policy is live — `lengthBand` and the move replace
`followupLength`/`askStyle`, which would otherwise contradict them. `recipe.strategy` is still
stamped for continuity; on conversation sends the attribution that matters is `move`.

### 7.2 First message at acceptance (fixes failure #1)
Today the note and the follow-up come from **one** brain call (`draftLinkedIn`), and the
first-touch lints (pair judge, repeated-opener skeleton, in-run skeleton list) run on the
follow-up (`copy-draft.ts:246-279`). Change:
- A new **note-only** brain `copy/linkedin-note.ts` (own registered prompt + hash; the note's
  content model and ML-3's why-now citation are carried over verbatim). The pair brain
  `copy/linkedin.ts` is kept untouched as the `"off"`-knob fallback, so the ML-3 hash invariant
  holds for the fallback path and byte-identical behaviour remains available.
- The anti-template guard moves with the message: the composer gets `avoidSkeletons` (account-wide
  recent openers, already in `CopyContext`) and the skeleton lint runs on the first message at
  composition time. The pair judge is replaced by the move-aware judge on the single message.
- Trigger = a dispatcher scan **"connected, no first message, no unsent draft"** — not a hook on
  any one acceptance path (webhook, `sync-connections`, and the "already connected" invite cancel
  all converge on `leads.linkedin_connected_at`). The scan creates the first message through
  reader→policy→composer with `stage=connected` and `hooksUsed=[note's hook]` (or no hook when no
  note was sent). "Acceptance = touch 1" semantics in `connectionGate` are unchanged; the touch's
  body is produced at that moment. Review-mode accounts see it in Approvals when it is written.

### 7.3 Learner (`conversation/learn.ts`, pure; follows ML-1's shrinkage pattern)
- **Unit of learning:** a decision `(archetype, stage, move, style)` with its `propensity`.
- **Reward** (scalar, my call, tunable in one constant table):
  reply within 7d +1 · positive stance +2 · each further lead turn +1 (cap 3) · meeting booked
  +10 · explicit opt-out −5 · negative stance −2 · `identitySuspicion` −4 · human takeover 0
  (neutral) · `wait` that was followed by a lead reply +1. Terminal outcomes dominate by design
  `[R rule 25]`. (Link clicks are not tracked — owner decision, §12.)
- **Granularity and pooling (the atom of learning):** volume is tiny (44 sends in prod), so the
  learner pools hierarchically and only the margins with evidence carry weight:
  `move` (global) ⇐ `move × stage` ⇐ `move × stage × archetype`; **style is marginalized** at
  first (learned later as `move × lengthBand` only). Stages collapse to 5 learning phases
  (`pre-reply`, `engaged`, `exploring/qualified`, `asked`, `after-no`) and archetype to the 3×3×3
  grid, so the finest cell is 15 × 5 × 27 ≈ 2k, and the readout shows a cell only when its
  real n ≥ 5 — otherwise "not enough conversations yet" (never a prior dressed as a result).
- **Estimator:** per cell, Beta posteriors on "positive outcome" (reward > 0) and a Gaussian on
  the reward; inverse-propensity weighting so exploration doesn't bias; **hierarchical shrinkage**
  account ⇐ global ⇐ research prior (informative Beta from the rulebook, e.g. at `opened`:
  `observe` Beta(6,4), `soft_ask` Beta(3,7), `propose_times` Beta(1,9)). A cell with n<5 is the
  prior. Nothing here is a model; it is counts, so it is explainable in the readout.
- **Credit assignment:** a reply credits the last agent message before it (sets
  `replies.outreach_send_id`, unused today); a meeting credits the message that carried the
  booking link (or the last agent message) plus, at 0.5 weight, every agent message in the
  thread (conversation-level reward `[R §6]`). A send whose body the user edited in Approvals is
  marked off-policy and excluded from learning.
- **Cadence:** nightly rollup task; per-account posteriors are read by the policy at decision
  time (one row per cell, cached in the bundle).

### 7.4 Cross-tenant pool (counts only)
`conversation_priors_global(level, archetype, phase, move, source, n, positives, reward_sum, reward_sq, updated_at)` —
`level ∈ {move, move_phase, move_phase_archetype}`, `source ∈ {real, sim}` (an enum, so sim-seeded
rows decay as real rows grow); service-role only, no `account_id`, no free text, no ids. A nightly
job reduces every tenant's decisions into it. Per-account rows live in
`conversation_priors(account_id, …)` with RLS. Guardrail test: the global table's columns are an
allow-list of numeric/enum columns; any migration adding a free-text or uuid column fails the test.

### 7.5 Outcome capture that doesn't exist yet
- **Reply attribution:** inbound sets `replies.outreach_send_id` to the last delivered send.
- **Booking attribution:** unchanged (ML-6 tags the booking link on the customer's domain);
  tagging extends from the reply path to every outbound that carries the booking link.
- **Identity suspicion:** reader flag, stored on the readout; counted as a guardrail metric.
- No click tracking of any link (owner decision): links stay exactly as the customer wrote them.

### 7.6 Decision log
New table `conversation_decisions(id, account_id, lead_id, scheduled_send_id nullable,
decided_at, mode ∈ {shadow, live}, phase, archetype, move, style_key, propensity, seed,
legal_moves jsonb, vetoes jsonb, state_snapshot jsonb, policy_version, prompt_hash)` with RLS,
service-role writes, retention cascading with the lead. `lab_decisions` (0070) is **not** reused:
its `scheduled_send_id NOT NULL` + unique + composite FK cannot hold a `wait`, a shadow decision,
or a decision taken when the old brain skipped. One row per decision incl. `wait`;
`scheduled_sends.recipe` gets v3: `{ ...v2, move, styleKey, policyVersion, propensity, decisionId }`.
In shadow mode the row records what the policy *would* have done and `scheduled_send_id` links to
the old brain's send when one exists, with `mode = shadow` so the learner never reads it as a
taken action.

## 8. Day-one intelligence: rulebook + simulation

- **Rulebook** = §6.2 predicates + the policy prompt's method guide: a compact, source-tagged
  rendering of `[R (b)]` and the "go-to responses" of `[R §3]` (not interested / send me info /
  what is this / we already use X / rude / silence). The guide describes *moves and when*, never a
  script to copy; the composer never sees practitioner wording.
- **Simulator** (`packages/agent-brains/src/conversation/sim/`): persona-conditioned LLM
  prospects — busy exec, skeptic, info-requester, reverse-seller, warm operator, rude, ghost —
  with **calibrated refusal/reply rates** from the research (e.g. first-message reply ≈ 15–20%,
  hard-CTA penalty, exec −30%) and an explicit rule that a persona may not be talked out of its
  disposition by tone alone `[R §6: sims over-persuaded]`. A judge scores each sim thread for
  pressure, manipulation, repetition, and identity detection; those scores are negative reward in
  pretraining. Output: the initial `conversation_priors_global` rows (flagged `source=sim`, shrunk
  harder than real data) and the multi-turn eval corpus.
- **Evals** (`packages/evals`): a multi-turn suite — the 5 production failure threads
  (exported and anonymized by the owner's session before build starts; fixture shape =
  `ConversationTurn[]` + expected readout/veto per turn) + 40 sim threads — with hard gates:
  zero second openers, zero pitch-before-exploring, zero illegal `propose_times`, question budget
  honoured, suppression only on explicit/high-confidence declines; advisory: judge `moveFit`,
  `humanness`, positive-reply rate in sim ≥ baseline brain. Runs in the existing `evals.yml`
  workflow (key-gated, path-triggered + nightly); the hard gates block merge there, and
  `/ship-phase` runs them locally. The existing single-turn suites keep their floors.

## 9. Rollout

1. **Shadow** (`app_settings.conversation_policy = "shadow"`): reader + policy run on every
   decision and log to `lab_decisions`; the current brain still writes the message. Two weeks or
   200 decisions, whichever first; the readout page shows "what the policy would have done".
2. **Live for first-message + replies** (`"live"`), proactive follow-ups still old brain.
3. **Live everywhere**; old `respond.ts` situation branches deleted.
4. Learner reads real data once a cell reaches n ≥ 5; sim priors decay as real n grows.

Kill switch: the existing `outreach_kill_switch` plus the knob set back to `"off"` (byte-identical
to today).

## 10. What the owner sees (plain, functional — owner restyles)

- Inbox thread: each agent message's label becomes the move in plain words ("asked one question",
  "offered the benchmark", "proposed times") instead of the play string; a hover shows the one-line
  rationale. No method names.
- Prospect page: "How Vera reads them" (3–4 chips: direct · skeptical · senior · prefers short),
  "Where this stands" (stage in plain words), and open loops.
- Readout ("What's working", ML-2 panel): positive-reply rate, avg prospect turns per thread,
  meetings; guardrails: opt-out rate, "asked if bot" count, takeovers. Own data only.
- Help: `agents-copy.md` + `inbox.md` updated (rule 09).

## 11. Conversation reliability (prerequisite, small)

- Re-runs already exist in principle: Trigger retries (3 attempts, ≤10 s backoff — too short to
  outlive a credit outage) and, with PR #83, the hourly thread sync re-routes every message
  through `handleLinkedInEvent`, which finishes a reply row that has no classification and answers
  it inside the 72 h window. Prerequisite therefore = (a) a test proving thread-sync re-answers a
  reply whose first run failed, and (b) an admin alert on the first AI-provider billing/auth error
  (the 10-23 outage was silent for three days).

## 12. Decisions made in the conversation (theirs)

- Learn from outcomes only; no rating UI. Cross-customer learning: yes, counts only.
- Personality axes that matter: skeptical, senior, direct, tone/warmth, plus NLP-derived notes.
- Rude prospects: polite and brief unless common sense says otherwise; the policy decides.
- Stages are a guide the system reasons over, not a fixed route; it picks and learns.
- Switch approach automatically, no approval step.
- Content before timing. No hard pushes; slight pushes allowed. No manipulation.
- Success = replies, longer conversations, meetings booked (all in the reward). **No link click
  tracking**: links stay exactly as written; the "CTA clicked" signal is dropped (2026-10-27).

## 13. Calls I made (check these)

- Suppression is written only on explicit opt-out or a high-confidence explicit decline; a
  low-confidence "no" stops the run and flags you instead (§6.4). Reverses today's rule for the
  ambiguous case; the explicit case is unchanged.
- Day-one learning uses informative research priors + simulation; real data overrides as it
  arrives (n ≥ 5 per cell). Sim priors are shrunk harder than real.
- Exploration never picks `propose_times`, `reframe`, or `poke` on its own.
- The first post-accept message is written at acceptance, not with the note.
- `wait` is a first-class move; silence can be the right answer and is learned.
- Reward constants in §7.3 are starting values in one table.
- Archetype buckets are 3×3×3 and stages collapse to 5 learning phases; the LLM sees the
  continuous state. Style is marginalized until there is data.
- A new `conversation_decisions` table is the decision log (`lab_decisions` can't hold `wait` or
  shadow rows); `lab_decisions` stays as-is.
- A note-only first-touch brain replaces the pair for the live path; the pair brain stays as the
  off-knob fallback. The anti-template skeleton guard moves to the composer.
- `wait` returns the sequence touch; the policy's follow-up ceiling runs below the user's count.
- Champion-strategy directives are dropped from conversation prompts (attribution = move).
- User-edited sends are off-policy for learning.

## 14. Left to the builder

- Exact prompt wording for reader/policy/composer (tests pin behaviour, not words).
- The compact state rendering (token budget ≤ ~700 tokens of state per call).
- Beta/Gaussian update formulas and the IPW clip (suggest clip at 10).
- Persona definitions and refusal-rate tables for the simulator; judge prompts.
- Migration sequencing (states, decisions, priors ×2; recipe v3 is jsonb-only).
- Backfill: replay stored threads through the reader to seed states before shadow mode.

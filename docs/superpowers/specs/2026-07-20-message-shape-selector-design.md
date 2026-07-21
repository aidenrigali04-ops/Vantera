# Message-Shape Selector — copy-brain design spec (2026-07-20)

Method: YC-head comparison/optimization (standing). Grounded in the live copy brain; every mechanism
names the real file/symbol it extends.

## The insight

The brain personalizes **content** (pain, trigger, `ai_insights`) but holds **shape** constant.
[`copy/linkedin.ts:46-48`](../../../packages/agent-brains/src/copy/linkedin.ts) mandates one shape for
every first message: *thanks → one observation → one question*. That shape is now the tell.
Sophisticated buyers pattern-match the observation-question silhouette in half a second regardless of
how specific the observation is. Varying words inside a fixed shape cannot escape the shape.

**Fix:** make the *shape* a strategy knob the brain chooses per lead and the bandit learns per segment.
Structural variety is the anti-detection mechanism: when no two messages share a shape, there is no
pattern to match.

This **supersedes** the F1 `openerShape: observation_question | freeform` knob in the reveal-freemium
plan (that knob is the thin version of this one). The F1 `texture: polished | fragmented` knob is
orthogonal and stays.

## 1. The knob

Add to `CopyStrategy` ([`copy/shared.ts:61`](../../../packages/agent-brains/src/copy/shared.ts)):

```ts
messageShape?:
  | "observation_question"   // DEFAULT — today's behavior, byte-identical
  | "trigger_consequence"
  | "provocation"
  | "gift"
  | "own_cold"
  | "disqualifier"
  | "peer_insider";
```

**Byte-identical default (non-negotiable, same contract as every other knob):** unset OR
`"observation_question"` renders the prompt exactly as today. Existing champions are unchanged; the
optimizer's null hypothesis is preserved.

`messageShape` joins `FIRST_TOUCH_ONLY_KNOBS` (shapes are opener structures; suppressed for the
conversation `TouchShape`, like `openWith`/`openerAngle`).

## 2. Structure vs compliance — the load-bearing separation

A shape rewrites **structure**. It must never touch **compliance**. These are enforced by different layers:

- **Compliance (never overridable, deterministic):** the de-pitch rules in `validateLinkedInDraft`
  (no links, no seller-company name, no call/meeting/demo/15-min ask) + the full humanizer
  (zero dashes, banned phrases, no lists/semicolons, ≤1 exclamation). These run **after** generation
  on every shape. A shape cannot buy its way past them.
- **Structure (overridable by shape):** the "thanks → observation → question" paragraph in
  `LINKEDIN_SYSTEM`.

**Required refactor of `LINKEDIN_SYSTEM`:** move the structural paragraph behind an explicit escape
hatch, so a shape directive can replace it legitimately:
> "Default shape, UNLESS a message-shape directive below replaces it: a brief thanks, one sharp
> observation, one curious question. The de-pitch rules (no product name, no link, no meeting ask)
> and the voice rules ALWAYS apply, whatever the shape."

`strategyDirectives` gets special handling for `messageShape` (mirroring the `openerAngle` special
case at [`shared.ts:108`](../../../packages/agent-brains/src/copy/shared.ts)): it emits
`Use this message shape instead of the default: <SHAPE_DIRECTIVE[shape]>` — the one directive that is
allowed to override structure, precisely because compliance is enforced elsewhere.

## 3. The shape catalog

`SHAPE_DIRECTIVE: Record<ShapeId, string>` (new, in `copy/shared.ts`). Each breaks a specific tell:

| Shape | Breaks the tell | Directive (prompt text, abbreviated) |
|---|---|---|
| `observation_question` | (default) | the current structure |
| `trigger_consequence` | manufactured "why now" | "Open on a real, recent trigger in their world and the specific downstream consequence they haven't clocked yet. The trigger is the reason to message now. End by making it easy to opt out." |
| `provocation` | the polite question | "Make one specific, slightly contrarian claim about their situation that invites correction. Take a stance, do not ask a curious question. No flattery." |
| `gift` | "outreach always asks" | "Lead with a genuinely useful observation or artifact and NO ask, no CTA, no question. Give and stop." |
| `own_cold` | false intimacy | "Admit openly this is cold and that you have not followed their work. State the one real, specific reason you are messaging. Refuse the research-flattery ritual." |
| `disqualifier` | "everyone gets this" | "Open by naming who this is NOT for, then the one condition under which it is worth their time. Take-away framing, confident, brief." |
| `peer_insider` | seller-studies-buyer | "Say the one thing only someone who does exactly what they do would notice. Peer to peer, never seller to buyer. Requires a real shared-domain signal." |

Directive prose is written **dash-free** (per the [`shared.ts:161`](../../../packages/agent-brains/src/copy/shared.ts) note: prompt prose primes output style).

## 4. Per-shape length budgets

The fixed `FOLLOWUP_MAX_CHARS = 180` / `FOLLOWUP_MAX_WORDS = 28` are tuned for the question shape.
Other shapes need room to land a consequence (verified: the industry drafts run 200-250 chars).
Add `SHAPE_BUDGET: Record<ShapeId, {maxChars: number; maxWords: number}>` (launch values, tunable):

| Shape | maxChars | maxWords |
|---|---|---|
| observation_question | 180 | 28 |
| provocation | 170 | 27 |
| peer_insider | 210 | 34 |
| disqualifier | 215 | 34 |
| trigger_consequence | 245 | 40 |
| gift | 245 | 40 |
| own_cold | 245 | 40 |

`validateLinkedInDraft` takes the shape's budget instead of the constant. The connection-note cap
(`CONNECTION_NOTE_MAX_CHARS = 200`) is unchanged — shapes govern the first message, not the note.

## 5. The selector — champion default + bandit exploration

Two mechanisms, coexisting exactly like `openWith` (deterministic default) and `openerAngle` (generated):

**(a) Deterministic champion default — trigger-aware, `selectMessageShape(insights, context)` (new, pure).**
Picks the shape the *available signal* justifies, so shapes only fire when their premise is real:
- strong recent trigger in `ai_insights` (funding, hiring, tool switch, role change) → `trigger_consequence`
- a real shared-domain signal (seller and prospect do the same thing) → `peer_insider`
- a deliverable artifact is available (a teardown/insight) → `gift`
- thin signal, public post only → `observation_question` (the safe floor)
- **the bold shapes (`provocation`, `disqualifier`, `own_cold`) are NEVER auto-selected** — exploration-only (§7).

This is the "shape per lead based on what's actually true" principle: no trigger, no
`trigger_consequence`; no insider signal, no `peer_insider`.

**(b) Bandit exploration (Stage-1b).** `messageShape` is proposed as a challenger knob and learned per
segment. `strategySignature` ([`optimize/bandit.ts:14`](../../../packages/agent-brains/src/optimize/bandit.ts))
sorts keys and drops empties, so it **already** includes `messageShape` with zero changes — a shape's
per-recipe outcomes aggregate for free, and `chooseChallenger`/EB-shrinkage rank shapes against the
champion. The optimizer tilts toward winning shapes instead of us guessing.

## 6. Generation gate (`optimize/generate.ts`)

- Extend `candidateSchema` with `messageShape: z.enum([...]).optional()`.
- Extend `GENERATE_SYSTEM` to describe the knob and its rule: *"messageShape is a STRUCTURE, not a
  claim. Propose a shape only when the lead's signal supports it (do not propose trigger_consequence
  with no trigger)."*
- Map `raw.messageShape → c.messageShape` in `proposeRecipeCandidates`, gated by a closed-set enum
  check (a new tiny validator beside `validateRecipeAngle` — the shape is an enum, so it needs
  membership validation, not the free-text angle length/claim gate). Unknown value → dropped.
- The knob-flip baseline (candidate 0) is unaffected; the loop keeps working if the LLM proposes none.

## 7. Safety / risk gating

Shapes vary in social risk. The safe ones can auto-select; the bold ones must be earned.
- **Safe subset** (`observation_question`, `trigger_consequence`, `gift`, `peer_insider`): available to
  the deterministic selector and the generator for all accounts.
- **Bold subset** (`provocation`, `disqualifier`, `own_cold`): **exploration-only, and only on
  accounts that opt in** via `app_settings` `bold_shapes_account_ids` (same admin-pin pattern as
  `reveal_pilot_account_id`). Proven on the Vantera account first, then opened. Never
  deterministically auto-selected anywhere.
- All shapes ride the **review queue + humanizer** unchanged. A shape never silent-sends anything the
  humanizer flags.
- `PROSPECT_ACCURACY_RULE` still applies: a shape that misdescribes the prospect's business is a
  worse failure than a generic message, so the accuracy contract is never relaxed by a shape.

## 8. Attribution — free

`messageShape` is a `CopyStrategy` field, so it rides the whole existing chain unchanged:
`buildSendRecipe` → `scheduled_sends.recipe` → per-arm flags → `runOptimize` →
`decideExperimentV2`. Every shaped send carries full send→reply→interested→booked attribution with no
new plumbing.

## 9. Tests (colocated, per rule 13)

1. **Byte-identical default:** unset and `"observation_question"` produce identical prompts + identical
   drafts (mock model) to pre-change. The optimizer null is preserved.
2. **Compliance survives every shape:** each of the 7 shapes' representative copy passes
   `validateLinkedInDraft` + `validateHumanity` (the seven industry drafts, already verified 0
   violations, become the fixture).
3. **Structure override is scoped:** a shape replaces the observation-question paragraph but a
   product name / link / meeting ask in the output is STILL flagged (proves the override is
   structure-only, not a compliance hole).
4. **Length budget:** each shape validates against its own budget; a `trigger_consequence` at 240 chars
   passes, an `observation_question` at 240 fails.
5. **Selector is signal-gated:** `selectMessageShape` returns `trigger_consequence` only when a trigger
   is present; returns `observation_question` on thin signal; never returns a bold shape.
6. **Bold-shape pinning:** a non-pinned account never gets a bold shape from the selector OR the
   generator; a pinned account can explore them.
7. **Signature aggregation:** two recipes differing only in `messageShape` aggregate to distinct
   signatures (confirms the bandit learns per shape).

## 10. Rollout

- **M1 (knob + safe selector):** `messageShape` field, `LINKEDIN_SYSTEM` refactor, `SHAPE_DIRECTIVE`,
  `SHAPE_BUDGET`, `selectMessageShape` (safe subset only), validator, tests. No generation, no bold
  shapes. Champion becomes trigger-aware immediately; still byte-identical when signal is thin.
- **M2 (bandit exploration):** generator schema/prompt/mapping + enum gate. The optimizer starts
  proposing safe-shape challengers and learning per segment.
- **M3 (bold shapes):** `bold_shapes_account_ids` pin, explore `provocation`/`disqualifier`/`own_cold`
  on the Vantera account, read the per-shape numbers, then open the winners.

M1 is shippable on its own and is the highest-value slice: it makes every champion message
trigger-aware and breaks the single-shape monotony, with zero optimizer or risk surface added.

## Out of scope
- Shape selection for the conversation responder (shapes are opener structures; the responder's
  anti-restart rules govern mid-thread).
- Medium switches (voice note / Loom) — a separate channel capability, not a copy shape.
- Per-shape exemplar pools — fold in later if a shape's win-rate justifies dedicated few-shot examples.

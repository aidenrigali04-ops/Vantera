# Retell Cold-Call Agent — Prompt & Knowledge Base

These files configure the Retell agent that Vantera's caller pipeline dials through.
They are the **persistent, product-agnostic cold-calling layer**. Everything specific to a
given lead and offer is injected at call time by the adapter — do not hardcode a product here.

## Files
| File | Goes into Retell as | Purpose |
|------|---------------------|---------|
| [agent-prompt.md](agent-prompt.md) | Agent **General Prompt** | Identity, call arc, guardrails, outcome classification. Embeds `{{prompt}}`. |
| [knowledge-base/01-cold-call-frameworks.md](knowledge-base/01-cold-call-frameworks.md) | Knowledge Base doc | Permission opener, SPIN, gap selling, Challenger, closes, voicemail. |
| [knowledge-base/02-objection-handling.md](knowledge-base/02-objection-handling.md) | Knowledge Base doc | LAER method + objection library with responses. |
| [knowledge-base/03-psychology-framing.md](knowledge-base/03-psychology-framing.md) | Knowledge Base doc | Cialdini, tactical empathy, framing, reactance, ethics. |
| [knowledge-base/04-compliance-and-conduct.md](knowledge-base/04-compliance-and-conduct.md) | Knowledge Base doc | Recording disclosure, honesty, DNC, pressure limits. |

The `knowledge-base/` files are the clean, upload-ready copies (no internal references).

## How it wires into Vantera
The adapter is `packages/voice-infra/src/retell.ts`. On `placeCall` it sends, in
`retell_llm_dynamic_variables`:
- **`prompt`** — `briefToPrompt(req)`: the per-lead Call Brief (persona name, opening line,
  talking points, a consequence question, the meeting's value angle, the de-risked next step,
  objection cues, goal + booking link) built by
  `packages/agent-brains/src/caller/brief.ts`.
- **`voice_id`**, **`language`**.

So the **General Prompt must contain `{{prompt}}`** (it's where the brief lands) and may
reference `{{voice_id}}` / `{{language}}`. This is already noted in the caller-agent memory.

Division of labor:
- **These files** = how to cold call well, for any offer (constant across leads/customers).
- **The brief (`{{prompt}}`)** = what to say about *this* lead and *this* offer (changes every call).

That separation is deliberate: the same Retell agent works whether the caller is selling
Vantera itself or a Vantera customer's product — only the brief changes.

## Setup checklist (Retell dashboard)
1. Create a **Single-Prompt** agent. Paste the body of `agent-prompt.md` (everything below
   the "PROMPT (copy below this line)" marker) into the **General Prompt**.
2. Add a **Knowledge Base**, upload the four `kb-*.md` files, and attach it to the agent.
3. Set the voice on the agent (the adapter also passes `voice_id` as a dynamic var; pin a
   default voice on the agent too).
4. Buy/bind an outbound number → set `VOICE_FROM_NUMBER`. Set `VOICE_API_KEY` (needs the
   "webhook" capability so signatures verify). Point the agent's webhook at
   `/api/webhooks/voice` (ngrok tunnel for local).
5. Optional: set `VOICE_AGENT_ID` → adapter sends it as `override_agent_id` on create-call.
6. `trigger deploy` so the `call-dispatch` cron and webhook task run live.

(See the caller-agent memory for the full operational state of keys/webhook/deploy.)

## Outcome contract
The prompt drives the call toward exactly one outcome from
`packages/agent-brains/src/caller/schema.ts` → `CALL_OUTCOMES`:
`booked | callback | not_interested | no_answer | voicemail | do_not_call`.
`not_interested` and `do_not_call` trigger phone suppression downstream — the prompt is
written to make those endings explicit so classification is clean.

## Tuning notes
- Keep the General Prompt tight; long prompts make voice agents slower and more robotic.
  The depth lives in the Knowledge Base, retrieved on demand.
- If you want a version specialized to sell **Vantera itself**, don't edit these files —
  encode the Vantera value angle in the brief generator (`brief.ts` / the lead input),
  so the methodology layer stays reusable.
- Methods are sourced from established B2B sales practice: Josh Braun (permission openers),
  Chris Voss / *Never Split the Difference* (tactical empathy), Rackham *SPIN Selling*,
  Keenan *Gap Selling*, Dixon & Adamson *The Challenger Sale*, Cialdini *Influence*,
  Jeremy Miner *NEPQ / The New Model of Selling* (tonality, detached frame, consequence
  questions, Clarify–Discuss–Diffuse), Alex Hormozi *$100M Offers* (value equation:
  the meeting framed as the offer, risk reversal). Adopt the value-communication and
  diagnosis logic, not the urgency/scarcity tactics — honest speed framing only.

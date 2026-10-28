import { generateObject, NoObjectGeneratedError, type LanguageModel } from "ai";
import { z } from "zod";
import { getModel, registerPrompt } from "@vantera/ai";
import { MOVE_DEFINITIONS, type LinkKind, type Move, type MoveDecision, type Style, type Trigger } from "./moves";
import { EXPLORE_SAFE, mirrorAllowed, type Veto } from "./rules";
import { thompsonPick, type Level } from "./priors";
import type { Readout } from "./read";
import { renderState, type ConversationState } from "./state";

export const POLICY_VERSION = 1;

export const POLICY_SYSTEM = registerPrompt("conversation/policy", `You choose the seller's next move in a 1:1 LinkedIn conversation. You do NOT write the message; you rank 1 to 3 candidate moves, best first, each with a style and a one-sentence rationale. Only moves on the legal menu are allowed; the vetoes explain what was removed and why.

Move vocabulary (what each move means):
- answer: answer their question in one plain sentence, no claims.
- acknowledge: reflect back what they said, tentatively, when the message carried feeling.
- observe: a useful, checkable observation about their world that earns the right to talk.
- ask_discovery: ONE easy question they can answer in a few words.
- poke: one neutral question about how they know the current approach works.
- reframe: one commercial insight that changes how they see the problem (senior people).
- narrow: an either/or that turns a request for info into a short conversation.
- offer_value: a specific asset or benchmark they can keep even if they never buy.
- soft_ask: a low-pressure check on interest in a next step.
- propose_times: two specific times or a booking link, only after a clear yes.
- confirm: confirm the agreed next step and nothing else.
- graceful_exit: close in one line, leave the door open, never pitch again.
- breakup: a final note with one last useful thing, no guilt.
- wait: say nothing for now; silence is a valid choice.
- hand_to_human: stop and alert the owner.

When to use what:
- One easy question per message. Earn the right to ask before asking: give something first.
- Interest-type asks ("is this worth a look?") come before time asks. Propose times only after a clear yes.
- "Not interested": agree, then either one disarming either/or or a clean exit. Never argue.
- "Send me info": narrow it with an either/or instead of dumping a deck.
- "What is this?": answer in one plain sentence, then stop.
- "We already use X": one neutral poke about how they know it works; no comparison, no attack.
- Rudeness or hostility: one graceful exit.
- Silence: add value (offer_value or observe), never a bump like "just checking in".
- Prefer the moves whose prior rate is higher when the situation is otherwise a toss-up, but the situation always outranks the prior.

Reading the person:
- C-level or founder: short, no discovery chains, offer an insight rather than asking them to explain.
- Skeptical (high skepticism): drop claims, lower the temperature, and offer the exit.
- Direct (high directness): at most 2 lines, lead with the point.
- lengthBand: one_line (about 120 chars), short (about 240), standard (about 320). question: whether the message ends in a question. link: none, website, content or booking, only if available. mirror: echo their register (greeting, sign-off, emoji) only when it fits.

Hard rules:
- Never name a sales methodology or framework in a rationale or anywhere else.
- Every rationale must cite at least one concrete fact from the state or the incoming message (a stage, a quoted phrase, a counter, an open objection). A rationale with no concrete fact is invalid.
- Choose only from the legal menu.`);

export type PolicyInput = {
  state: ConversationState;
  trigger: Trigger;
  readout?: Readout;
  incoming?: string;
  legal: Move[];
  vetoes: Veto[];
  priors: { move: Move; rate: number; n: number; level: Level }[];
  links: { booking: boolean; website: boolean; content: boolean };
  cta: string;
};

export type Shortlist = { candidates: { move: Move; style: Style; rationale: string }[] };

const LENGTH_BANDS = ["one_line", "short", "standard"] as const;
const LINK_KINDS = ["none", "website", "content", "booking"] as const;
const NO_QUESTION: ReadonlySet<Move> = new Set<Move>(["wait", "hand_to_human", "graceful_exit", "breakup", "confirm"]);
const DEFAULT_STYLE: Style = { lengthBand: "short", question: false, link: "none", mirror: false };

function outputSchema(legal: Move[]) {
  const move = legal.length > 0 ? z.enum(legal as [Move, ...Move[]]) : z.literal("wait");
  return z.object({
    candidates: z
      .array(
        z.object({
          move,
          style: z.object({
            lengthBand: z.enum(LENGTH_BANDS),
            question: z.boolean(),
            link: z.enum(LINK_KINDS),
            mirror: z.boolean(),
          }),
          rationale: z.string(),
        }),
      )
      .min(1)
      .max(3),
  });
}

export function renderPolicyPrompt(input: PolicyInput): string {
  const { state, links } = input;
  const available = (["booking", "website", "content"] as const).filter((k) => links[k]);
  return [
    `STATE\n${renderState(state)}`,
    `TRIGGER: ${input.trigger}`,
    ...(input.readout ? [`READOUT: stance ${input.readout.stance} (${input.readout.confidence.toFixed(2)}), intent ${input.readout.intent}`] : []),
    ...(input.incoming ? [`INCOMING MESSAGE:\n${input.incoming.slice(0, 2000)}`] : []),
    `LEGAL MENU\n${input.legal.map((m) => `${m} — ${MOVE_DEFINITIONS[m]}`).join("\n") || "(none)"}`,
    `VETOES\n${input.vetoes.map((v) => `${v.move}: ${v.rule} (${v.source})`).join("\n") || "(none)"}`,
    `PRIORS\n${input.priors.map((p) => `${p.move}: ${p.rate.toFixed(2)} (${p.n}, ${p.level})`).join("\n") || "(none)"}`,
    `LINKS AVAILABLE: ${available.join(", ") || "none"}`,
    `CTA: ${input.cta}`,
  ].join("\n\n");
}

function allowedLink(move: Move, link: LinkKind, input: PolicyInput): LinkKind {
  if (link === "none") return "none";
  const { links, state } = input;
  const shared = state.memory.linksShared;
  if (move === "offer_value") return link === "content" && links.content ? "content" : "none";
  if (move === "propose_times" || move === "confirm") return link === "booking" && links.booking ? "booking" : "none";
  if (move === "answer" || move === "soft_ask") {
    if (link === "website" && links.website && shared.website === 0) return "website";
    if (link === "booking" && links.booking && shared.booking === 0) return "booking";
  }
  return "none";
}

function normalize(c: Shortlist["candidates"][number], input: PolicyInput): Shortlist["candidates"][number] {
  return {
    move: c.move,
    rationale: c.rationale.trim(),
    style: {
      lengthBand: c.style.lengthBand,
      question: NO_QUESTION.has(c.move) ? false : c.style.question,
      link: allowedLink(c.move, c.style.link, input),
      mirror: mirrorAllowed(input.state) ? c.style.mirror : false,
    },
  };
}

export async function shortlistMoves(input: PolicyInput, model: LanguageModel = getModel()): Promise<Shortlist> {
  let raw: Shortlist["candidates"] = [];
  try {
    const { object } = await generateObject({
      model,
      schema: outputSchema(input.legal),
      system: POLICY_SYSTEM.text,
      prompt: renderPolicyPrompt(input),
      maxOutputTokens: 600,
    });
    raw = object.candidates as Shortlist["candidates"];
  } catch (err) {
    // An output that violates the schema (e.g. a move outside the legal menu) is treated as "no usable
    // candidate" and falls to the safe default below; transport/provider errors still propagate.
    if (!NoObjectGeneratedError.isInstance(err)) throw err;
  }
  const legal = new Set<Move>(input.legal);
  const candidates = raw
    .filter((c) => legal.has(c.move) && c.rationale.trim().length > 0)
    .map((c) => normalize(c, input))
    .slice(0, 3);
  if (candidates.length > 0) return { candidates };
  if (legal.has("wait")) return { candidates: [{ move: "wait", style: { ...DEFAULT_STYLE }, rationale: "no legal move fits; waiting" }] };
  const first = input.legal[0];
  return first
    ? { candidates: [{ move: first, style: { ...DEFAULT_STYLE }, rationale: "no legal move fits; waiting" }] }
    : { candidates: [] };
}

export function decideMove(
  shortlist: Shortlist,
  posteriors: Map<Move, { alpha: number; beta: number }>,
  rng: () => number,
): MoveDecision & { shortlist: Shortlist["candidates"] } {
  const top = shortlist.candidates[0];
  if (!top) throw new Error("empty shortlist");
  const all = shortlist.candidates;
  if (!EXPLORE_SAFE.has(top.move)) {
    return { move: top.move, style: top.style, rationale: top.rationale, propensity: 1, shortlist: all };
  }
  const safe = all.filter((c) => EXPLORE_SAFE.has(c.move));
  const { index, propensity } = thompsonPick(safe.map((c) => c.move), posteriors, rng);
  const pick = safe[index] ?? top;
  return { move: pick.move, style: pick.style, rationale: pick.rationale, propensity, shortlist: all };
}

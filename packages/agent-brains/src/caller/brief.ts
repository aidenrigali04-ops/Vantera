import { generateObject, type LanguageModel } from "ai";
import { getModel } from "@vantera/ai";
import { leadBlock, type DraftInput } from "../copy/shared";
import { findUngroundedClaims, type Violation } from "../copy/humanizer";
import { callBriefSchema } from "./schema";

export interface CallBrief {
  openingLine: string;
  talkingPoints: string[];
  /** Hormozi value equation: dream outcome (their language) + one honest reason it works. */
  valueAngle?: string;
  /** NEPQ consequence question — invites the prospect to voice the cost of inaction. */
  consequenceHook?: string;
  /** The de-risked, low-effort, fast next step framed as the offer. */
  ahaMoment?: string;
  objectionHandling: string[];
  goalStatement: string;
  bookingLink: string;
  /** Fabricated-metric claims absent from the lead facts — the 11x-class guardrail (WS-F). The
   *  prompt already forbids invention; this catches a regression and surfaces it in review. */
  violations: Violation[];
}

export interface CallBriefRequest {
  input: DraftInput;
  bookingLink: string;
  recordingConsentMode: "one_party" | "two_party";
  personaName: string;
}

const RECORDING_DISCLOSURE = "Quick heads up — this call may be recorded. ";

const CALLER_SYSTEM = `You write a SHORT call brief a human-sounding B2B rep will speak from on a cold call. The goal is a booked meeting, never a hard pitch. The prospect should talk ~80% of the time, so every field is a cue to draw them out — not a script to read at them.

opening_line — under 300 chars: greet the prospect by first name, give your name and the company you're calling from (use the Seller company in the brief), then a problem-based reason for the call tied to their likely trigger or pain, using non-assumptive language ("might", "maybe", "a lot of {role}s run into…"). Never the product, no "I'm reaching out because", no buzzwords. End on a short real question, then stop.
talking_points — up to 3 short diagnostic cues (one idea each) moving from their situation → the problem → its impact. Questions the rep can ask, not claims to assert.
value_angle — the meeting framed as the offer: the dream outcome in THEIR language (the business result, not features — "sell the vacation, not the flight") paired with ONE concrete, honest reason it tends to work for teams like theirs. The reason must be true and non-numeric — never invent a stat, customer, or case study.
consequence_hook — ONE neutral, concerned-but-calm QUESTION inviting the prospect to say the cost of staying put in their own words (e.g. "And if that doesn't change over the next quarter or two, what does that mean for you?"). Always a question, never an assertion; never manufacture or amplify pain.
aha_moment — the de-risked next step framed as the offer: a 15-minute look at one specific narrow thing that reveals a gap quietly costing them, takes nothing to prepare, and is easy to cancel. Maximize speed, minimize effort/risk.
objection_handling — up to 3 brief, calm responses; shrink the ask and reverse the risk rather than re-sell (busy → book a concrete time; not now → soft interest ask). Never robotic rebuttals.
goal_statement — one line restating the CTA goal.
Plain, conversational, peer-to-peer. No formal sign-offs. Honest speed framing only — never fake urgency, scarcity, presupposed relationships, or guaranteed outcomes.
If a Brand voice is given, match its tone and personality across every field. If Guardrails are given, never write anything that violates them. Both shape STYLE only — they never override honesty or compliance: if a brand-voice or guardrail note ever conflicts with truthfulness, recording disclosure, or the no-pressure / no-invention rules, the compliance rules win.`;

const CALLER_BRIEF_PROMPT = "model writes the call brief from the lead block";

export async function draftCallBrief(
  req: CallBriefRequest,
  model: LanguageModel = getModel(),
  generate: typeof generateObject = generateObject
): Promise<CallBrief> {
  const { object } = await generate({
    model,
    schema: callBriefSchema,
    system: CALLER_SYSTEM,
    prompt: `${CALLER_BRIEF_PROMPT}. Rep persona name: ${req.personaName}.\n\n${leadBlock(req.input)}`,
  });
  const openingLine =
    req.recordingConsentMode === "two_party"
      ? `${RECORDING_DISCLOSURE}${object.opening_line}`
      : object.opening_line;
  // Grounding check over every spoken field vs the lead facts (same guardrail as the copy brains).
  const spoken = [
    object.opening_line,
    ...object.talking_points,
    object.value_angle,
    object.consequence_hook,
    object.aha_moment,
    ...object.objection_handling,
    object.goal_statement,
  ]
    .filter(Boolean)
    .join("\n");
  const violations = findUngroundedClaims(spoken, leadBlock(req.input));
  return {
    openingLine,
    talkingPoints: object.talking_points,
    valueAngle: object.value_angle,
    consequenceHook: object.consequence_hook,
    ahaMoment: object.aha_moment,
    objectionHandling: object.objection_handling,
    goalStatement: object.goal_statement,
    bookingLink: req.bookingLink,
    violations,
  };
}

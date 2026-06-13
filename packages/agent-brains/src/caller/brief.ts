import { generateObject, type LanguageModel } from "ai";
import { getModel } from "@vantera/ai";
import { leadBlock, type DraftInput } from "../copy/shared";
import { callBriefSchema } from "./schema";

export interface CallBrief {
  openingLine: string;
  talkingPoints: string[];
  objectionHandling: string[];
  goalStatement: string;
  bookingLink: string;
}

export interface CallBriefRequest {
  input: DraftInput;
  bookingLink: string;
  recordingConsentMode: "one_party" | "two_party";
  personaName: string;
}

const RECORDING_DISCLOSURE = "Quick heads up — this call may be recorded. ";

const CALLER_SYSTEM = `You write a SHORT call brief a human-sounding B2B rep will speak from on a cold call. The goal is a booked meeting, never a hard pitch.

opening_line — under 300 chars: greet by first name, say who's calling, one warm reason for the call tied to their trigger or pain. No script-speak, no "I'm reaching out because", no buzzwords.
talking_points — up to 3 short cues tying their pain/trigger to the value angle as a concrete outcome.
objection_handling — up to 3 brief, calm responses (busy → offer a callback; not now → soft interest ask).
goal_statement — one line restating the CTA goal.
Plain, conversational, peer-to-peer. No formal sign-offs.`;

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
  return {
    openingLine,
    talkingPoints: object.talking_points,
    objectionHandling: object.objection_handling,
    goalStatement: object.goal_statement,
    bookingLink: req.bookingLink,
  };
}

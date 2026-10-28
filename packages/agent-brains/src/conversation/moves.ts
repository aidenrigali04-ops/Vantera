export const MOVES = [
  "answer",
  "acknowledge",
  "observe",
  "ask_discovery",
  "poke",
  "reframe",
  "narrow",
  "offer_value",
  "soft_ask",
  "propose_times",
  "confirm",
  "graceful_exit",
  "breakup",
  "wait",
  "hand_to_human",
] as const;
export type Move = (typeof MOVES)[number];

export type Trigger = "reply" | "first_message" | "followup";

export type LengthBand = "one_line" | "short" | "standard";
/** Max characters per band. */
export const LENGTH_BAND_CHARS: Record<LengthBand, number> = { one_line: 120, short: 240, standard: 320 };

export type LinkKind = "none" | "website" | "content" | "booking";

export type Style = { lengthBand: LengthBand; question: boolean; link: LinkKind; mirror: boolean };

export type MoveDecision = { move: Move; style: Style; rationale: string; propensity: number };

/** Compact key for learning, e.g. "short|q|none|m". */
export function styleKey(style: Style): string {
  return [style.lengthBand, style.question ? "q" : "-", style.link, style.mirror ? "m" : "-"].join("|");
}

export const MOVE_DEFINITIONS: Record<Move, string> = {
  answer: "Answer their question in one plain sentence, with no claims, when they have asked something.",
  acknowledge: "Reflect back what they said, tentatively, when their message carried feeling.",
  observe: "Share a useful, checkable observation about their world that earns the right to talk.",
  ask_discovery: "Ask one easy question they can answer in a few words.",
  poke: "Neutrally ask how they know a current approach is working, when they say they are fine as is.",
  reframe: "Offer one commercial insight that changes how they see the problem, for senior people.",
  narrow: "Offer an either/or that turns a request for info into a short conversation.",
  offer_value: "Offer a specific asset or benchmark they can keep even if they never buy.",
  soft_ask: "Check interest in a next step with a low-pressure question.",
  propose_times: "Suggest two specific times or a booking link once they have clearly said yes.",
  confirm: "Confirm the booking or agreed next step and nothing else.",
  graceful_exit: "Close in one line, leave the door open, and do not pitch again.",
  breakup: "Send a final note with one last useful thing and an open door, with no guilt.",
  wait: "Say nothing for now; staying quiet is a valid choice.",
  hand_to_human: "Stop and alert the owner because a person should take this from here.",
};

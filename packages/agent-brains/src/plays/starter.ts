import type { CopyStrategy } from "../copy/shared";

/**
 * Starter plays — the honest day-one brain (spec 2026-07-14, Stage 0).
 *
 * A play is a complete, named way of running a first conversation, expressed as the SAME bounded
 * CopyStrategy the optimize loop tests and adopts — so "the plays Vera runs" is literally true:
 * the matched play's strategy seeds `optimization_playbook.champion_strategy` at onboarding, and
 * the autonomous loop sharpens it from there. Pure module, no DB: curated content ships in git,
 * is versioned, and is testable (every example opener must pass the real humanizer lint).
 *
 * HONESTY CONTRACT: each play carries its true source. `first_party` = the configuration our own
 * outbound ran (the homepage's real first-party numbers). `research` = grounded in buyer research,
 * not yet proven on our own sends. NEVER label a play as proven across customer accounts — that
 * network does not exist yet (see the spec's launch-time label correction).
 */
export type StarterPlay = {
  slug: string;
  name: string;
  /** one plain-language line for UI cards */
  description: string;
  /** why the play works, in user words */
  why: string;
  /** the real engine configuration this play is — seeds the champion strategy. All three enum
   *  knobs are required; the open-ended openerAngle (Stage 1b) is generated later, never curated. */
  strategy: Required<Pick<CopyStrategy, "openWith" | "followupLength" | "askStyle">>;
  /** an example first-touch opener in the product voice; must pass validateHumanity (≤200 chars) */
  exampleOpener: string;
  source: "first_party" | "research";
  /** lowercase keywords matched against the account's industry + ICP text */
  audienceHints: string[];
};

export const SOURCE_LABEL: Record<StarterPlay["source"], string> = {
  first_party: "Proven on our own outbound",
  research: "Grounded in buyer research",
};

export const STARTER_PLAYS: StarterPlay[] = [
  {
    slug: "trigger-opener",
    name: "The trigger opener",
    description: "Open from something they actually did, then a soft interest check.",
    why: "People reply to messages about their own moves, not a stranger's pitch. Leading with their trigger earns the read; the soft ask makes saying yes easy.",
    strategy: { openWith: "trigger", followupLength: "standard", askStyle: "soft" },
    exampleOpener:
      "Saw your post on scaling the sales team this quarter. We help teams book qualified calls without adding headcount. Open to a quick intro?",
    source: "first_party",
    audienceHints: [],
  },
  {
    slug: "pain-first",
    name: "The problem-first note",
    description: "Name the pain they're living in one plain sentence, no pitch attached.",
    why: "Being understood earns more replies than being sold to. Founders and builders answer the person who clearly gets their problem.",
    strategy: { openWith: "pain", followupLength: "standard", askStyle: "soft" },
    exampleOpener:
      "Most founders we talk to end up doing outreach at midnight after the real work is done. That is the exact problem we take off your plate. Want to hear how?",
    source: "research",
    audienceHints: ["saas", "software", "founder", "startup", "marketing", "agency"],
  },
  {
    slug: "direct-ask",
    name: "The direct ask",
    description: "Tight message, one concrete next step. Built for busy senior buyers.",
    why: "Executives respect brevity and a clear ask. A specific fifteen-minute proposal outperforms vague interest checks with senior titles.",
    strategy: { openWith: "trigger", followupLength: "tight", askStyle: "specific" },
    exampleOpener:
      "You are scaling pipeline without scaling the team, and that is the exact problem we work on. Open to 15 minutes this week?",
    source: "research",
    audienceHints: ["ceo", "cfo", "coo", "cro", "vp", "chief", "executive", "director", "head of"],
  },
];

/**
 * Deterministic best-match ordering of the starter plays for an account's targeting. Scores each
 * play by audience-hint hits against the lowercased industry + ICP text; stable on ties (array
 * order, first-party default first). Always returns all plays, never empty — there is no cold
 * start, only a better-or-default ordering.
 */
export function matchStarterPlays(input: { industry?: string | null; icp?: string | null }): StarterPlay[] {
  const haystack = `${input.industry ?? ""} ${input.icp ?? ""}`.toLowerCase();
  return STARTER_PLAYS.map((play, i) => ({
    play,
    i,
    score: play.audienceHints.filter((hint) => haystack.includes(hint)).length,
  }))
    .sort((a, b) => b.score - a.score || a.i - b.i)
    .map((s) => s.play);
}

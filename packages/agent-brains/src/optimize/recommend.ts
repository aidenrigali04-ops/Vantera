import type { FunnelStageKey } from "./funnel";
import type { OutreachDiagnosis } from "./diagnose";

/**
 * Recommendation layer of the self-optimizing loop (Phase 2 — suggest-only)
 * (docs/superpowers/specs/2026-06-29-self-optimizing-outreach-design.md).
 *
 * Maps the single diagnosed leak to ONE concrete, grounded change the owner can act on today, via
 * controls that already exist. Deliberately a fixed best-practice catalog, not an LLM — Phase 2 must
 * be safe and un-hallucinated. Every recommendation targets exactly one lever and states its honest
 * expected direction; it never promises a number and never invents a change on a non-leak.
 */

export type RecommendationLever = "targeting" | "cta" | "content_cta" | "sales_process";

/** Where the owner goes to make the change today; null when the recommendation is advisory only. */
export type RecommendationAction = { label: string; href: string } | null;

export type OutreachRecommendation = {
  stageKey: FunnelStageKey;
  lever: RecommendationLever;
  /** the change, as an imperative headline */
  title: string;
  /** why it's the highest-leverage move for this leak — grounded, not generic */
  rationale: string;
  /** honest metric direction — never a promised number */
  expectedEffect: string;
  action: RecommendationAction;
  /** carried from the diagnosis — an "early" signal warrants a softer framing than "clear" */
  confidence: "early" | "clear";
};

const CATALOG: Record<FunnelStageKey, Omit<OutreachRecommendation, "stageKey" | "confidence">> = {
  acceptance: {
    lever: "targeting",
    title: "Tighten who you target",
    rationale:
      "Connection requests get declined most when the person isn't a clear fit — the request doesn't feel relevant, so it's ignored. Sharpening your ICP so every invite lands with someone who recognizes why you're reaching out lifts acceptance more than any wording change.",
    expectedEffect: "should raise your connection-acceptance rate",
    action: { label: "Refine your targeting", href: "/agents/scout/edit" },
  },
  reply: {
    lever: "content_cta",
    title: "Make the ask clearer and give the agent more to work with",
    rationale:
      "People accept but go quiet when the first message's ask is vague or reads like a pitch. A single, low-friction ask — plus supporting content the agent can reference — earns more replies than a longer message.",
    expectedEffect: "should raise the reply rate on accepted connections",
    action: { label: "Sharpen your CTA & content", href: "/agents/copy/edit" },
  },
  booking: {
    lever: "cta",
    title: "Turn your CTA into a concrete next step",
    rationale:
      'Interested replies stall when the ask is soft — "open to chatting?" farms interest that never lands on a calendar. Proposing a specific, small next step (a concrete 15-minute slot) converts more of that interest into booked meetings.',
    expectedEffect: "should raise the booking rate on interested replies",
    action: { label: "Sharpen your CTA", href: "/agents/copy/edit" },
  },
  close: {
    lever: "sales_process",
    title: "Your outreach is working — the gap is in the meetings",
    rationale:
      "Meetings are booking but not closing, which is a sales-conversation gap, not an outreach one. The agent is doing its job getting qualified people to the table; the improvement here is in how those meetings are run.",
    expectedEffect: "no outreach change is warranted",
    action: null,
  },
};

/** The single suggested change for the diagnosed leak; null when there is no leak to act on. */
export function recommendForDiagnosis(diagnosis: OutreachDiagnosis): OutreachRecommendation | null {
  if (diagnosis.status !== "leak" || !diagnosis.stageKey) return null;
  return { ...CATALOG[diagnosis.stageKey], stageKey: diagnosis.stageKey, confidence: diagnosis.confidence };
}

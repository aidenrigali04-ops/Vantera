import type { HiveOutcome } from "./outcome";

/**
 * The Hive's arenas — one per optimizable aspect of the funnel. The catalog lists the values the
 * world plants a response for and the live pipeline can apply. Research bots may propose outside
 * it. A value with no planted response adds nothing to the score, so it cannot be recorded as a
 * win. The live Hive still parses candidates with `validateGenome` and drops anything the product
 * cannot apply. The evaluator, not this list, is what stops a made-up result.
 *
 * `wired` says whether the live pipeline can apply the gene today. Unwired genes are valid in the
 * simulator and in planning, but the live Hive must refuse to start a container whose candidate
 * genomes change an unwired gene (see `liveGenes`). Never flip a gene to wired without the applier.
 *
 * Hard product invariants are NOT genes and can never be evolved: the 70+ qualification gate floor,
 * LinkedIn ceilings/pacing/warmup, suppression, approve-before-send as the default.
 *
 * Tracking is deliberately not an arena: it is the measurement layer every arena depends on (unit
 * stamps, propensities, outcome events). An arena that optimized its own scoreboard would be the
 * scorer-gaming failure this design exists to prevent.
 */

export type ArenaKey =
  | "prospecting"
  | "intent"
  | "qualification"
  | "outreach_first_touch"
  | "outreach_followup"
  | "conversation"
  | "closing";

export type GeneSpec = {
  values: readonly string[];
  /** the value an account starts on (the pre-Hive behavior) */
  default: string;
  /** can the live pipeline apply this gene today? */
  wired: boolean;
  /** where the applier lives / what it maps to — documentation for the wiring phase */
  appliesTo: string;
};

export type ArenaMetric = {
  /** does this unit count toward the arena's denominator? */
  inDenominator: (o: HiveOutcome) => boolean;
  success: (o: HiveOutcome) => boolean;
  /** harm signal over the same denominator (feeds the do-no-harm breaker) */
  harm: (o: HiveOutcome) => boolean;
  label: string;
};

export type ArenaSpec = {
  key: ArenaKey;
  label: string;
  /** which units this arena's containers assign (intent only sees intent-sourced units) */
  appliesToUnit: (u: { source: "icp" | "intent" }) => boolean;
  genes: Record<string, GeneSpec>;
  metric: ArenaMetric;
};

const deep = (o: HiveOutcome) => o.interested || o.booked;

export const ARENAS: Record<ArenaKey, ArenaSpec> = {
  prospecting: {
    key: "prospecting",
    label: "Prospecting: who to source",
    appliesToUnit: (u) => u.source === "icp",
    genes: {
      icpFocus: {
        values: ["onboarding_icp", "top_converting_icp", "closed_won_lookalike"],
        default: "onboarding_icp",
        wired: true,
        appliesTo: "targeting/allocate.ts allocateDiscovery quota split across ICPs",
      },
      seniorityTilt: {
        values: ["none", "founder_exec", "vp_director", "manager"],
        default: "none",
        wired: true,
        appliesTo: "targeting/tilt.ts seniority buckets (ordering only)",
      },
      companySize: {
        values: ["any", "1_50", "51_200", "201_1000"],
        default: "any",
        wired: false,
        appliesTo: "prospect-data ICP criteria headcount band (needs per-run override)",
      },
      signalFreshnessDays: {
        values: ["30", "90", "180"],
        default: "180",
        wired: false,
        appliesTo: "prospect/rank.ts SIGNAL_FRESH_DAYS (needs per-account override)",
      },
    },
    metric: {
      label: "interested or booked per sourced prospect",
      inDenominator: (o) => o.sourced,
      success: deep,
      harm: (o) => o.negative,
    },
  },
  intent: {
    key: "intent",
    label: "Intent: which buying signals to act on",
    appliesToUnit: (u) => u.source === "intent",
    genes: {
      watchTarget: {
        values: ["competitors", "creators", "keywords", "hashtags"],
        default: "keywords",
        wired: false,
        appliesTo: "intent/watchlist.ts watchlist emphasis",
      },
      minIntentLevel: {
        values: ["high", "medium"],
        default: "medium",
        wired: false,
        appliesTo: "intent/classify.ts verdict level threshold",
      },
      signalKind: {
        values: ["engagement", "content", "both"],
        default: "both",
        wired: false,
        appliesTo: "intent-scan signal kinds",
      },
      recencyDays: {
        values: ["3", "7", "14"],
        default: "7",
        wired: false,
        appliesTo: "intent-scan observation window",
      },
    },
    metric: {
      label: "interested or booked per intent-sourced prospect",
      inDenominator: (o) => o.sourced,
      success: deep,
      harm: (o) => o.negative,
    },
  },
  qualification: {
    key: "qualification",
    label: "Qualification: who enters outreach",
    appliesToUnit: () => true,
    genes: {
      // Never below 70: the qualification floor is a product promise, not a tunable.
      minScore: {
        values: ["70", "75", "80", "85"],
        default: "70",
        wired: true,
        appliesTo: "scout agent config min_score (floor 70 enforced in code)",
      },
      tiltStrength: {
        values: ["off", "default", "strong"],
        default: "default",
        wired: false,
        appliesTo: "targeting/tilt.ts TILT_CAP",
      },
    },
    metric: {
      label: "interested or booked per sourced prospect",
      inDenominator: (o) => o.sourced,
      success: deep,
      harm: (o) => o.negative,
    },
  },
  outreach_first_touch: {
    key: "outreach_first_touch",
    label: "Outreach: the first touch",
    appliesToUnit: () => true,
    genes: {
      openWith: {
        values: ["trigger", "pain"],
        default: "trigger",
        wired: true,
        appliesTo: "CopyStrategy.openWith",
      },
      // A closed family, not free text: the free-text openerAngle knob stays in the legacy loop.
      angleFamily: {
        values: ["none", "recent_post", "peer_in_niche", "trigger_event", "their_goal"],
        default: "none",
        wired: false,
        appliesTo: "CopyStrategy.openerAngle mapped from a fixed phrase per family",
      },
      messageShape: {
        values: ["observation_question", "trigger_consequence", "gift", "peer_insider"],
        default: "observation_question",
        wired: true,
        appliesTo: "CopyStrategy.messageShape (SAFE_SHAPES only; bold shapes never evolvable)",
      },
    },
    metric: {
      label: "accepted per invite",
      inDenominator: (o) => o.invited,
      success: (o) => o.accepted,
      harm: (o) => o.negative,
    },
  },
  outreach_followup: {
    key: "outreach_followup",
    label: "Outreach: follow-ups",
    appliesToUnit: () => true,
    genes: {
      followupLength: {
        values: ["tight", "standard"],
        default: "standard",
        wired: true,
        appliesTo: "CopyStrategy.followupLength",
      },
      touches: {
        values: ["1", "2", "3"],
        default: "2",
        wired: false,
        appliesTo: "sequence-config touches (bounded by daily message caps)",
      },
      touchGapDays: {
        values: ["2", "3", "5"],
        default: "2",
        wired: false,
        appliesTo: "sequence-config touchGapDays",
      },
    },
    metric: {
      label: "interested replies per accepted connection",
      inDenominator: (o) => o.accepted,
      success: (o) => o.interested,
      harm: (o) => o.negative,
    },
  },
  conversation: {
    key: "conversation",
    label: "Conversation: turning interest into meetings",
    appliesToUnit: () => true,
    genes: {
      askStyle: {
        values: ["soft", "specific"],
        default: "soft",
        wired: true,
        appliesTo: "CopyStrategy.askStyle",
      },
      bookingMode: {
        values: ["link", "propose_times"],
        default: "link",
        wired: false,
        appliesTo: "reply/respond.ts booking directive",
      },
      objectionStyle: {
        values: ["acknowledge_reframe", "answer_direct"],
        default: "answer_direct",
        wired: false,
        appliesTo: "reply/respond.ts objection directive",
      },
    },
    metric: {
      label: "meetings booked per interested reply",
      inDenominator: (o) => o.interested,
      success: (o) => o.booked,
      harm: (o) => o.negative,
    },
  },
  closing: {
    key: "closing",
    label: "Closing: meetings that convert",
    appliesToUnit: () => true,
    genes: {
      preMeetingBrief: {
        values: ["off", "on"],
        default: "off",
        wired: false,
        appliesTo: "meeting-layer brief to the seller (not yet built)",
      },
      reminderTiming: {
        values: ["none", "24h", "24h_and_2h"],
        default: "none",
        wired: false,
        appliesTo: "meeting reminders (not yet built)",
      },
    },
    metric: {
      label: "closed-won per meeting booked",
      inDenominator: (o) => o.booked,
      success: (o) => o.converted,
      harm: () => false,
    },
  },
};

export const ARENA_KEYS = Object.keys(ARENAS) as ArenaKey[];

/** Genes the LIVE pipeline can apply for an arena. */
export function liveGenes(arena: ArenaKey): string[] {
  return Object.entries(ARENAS[arena].genes)
    .filter(([, g]) => g.wired)
    .map(([k]) => k);
}

/** The arena's default genome — what an account runs before the Hive has learned anything. */
export function defaultGenome(arena: ArenaKey): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [k, g] of Object.entries(ARENAS[arena].genes)) out[k] = g.default;
  return out;
}

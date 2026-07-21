import { describe, expect, it } from "vitest";
import {
  BOLD_SHAPES,
  FACT_ASSERTING_SHAPES,
  MESSAGE_SHAPES,
  SAFE_SHAPES,
  SHAPE_BUDGET,
  SHAPE_DIRECTIVE,
  groundingHasShapeSignal,
  isMessageShape,
  isNoSignalToken,
  selectMessageShape,
  shapeBudget,
  validateProposedShape,
  type MessageShape,
} from "./shape";
import { leadBlock } from "./shared";
import { SAFE_PROFILE, type AccountConfigProfile } from "./profile";
import type { StoredInsights } from "../prospect/schema";

const insights = (over: Partial<StoredInsights> = {}): StoredInsights => ({
  pain_points: ["pipeline coverage"],
  triggers: ["hiring 3 SDRs"],
  motivations: ["growth"],
  value_angle: "fills funnel without headcount",
  aha_moment: "meetings in week one",
  summary: "fit",
  ...over,
});

// ── selectMessageShape — signal-gated + config-aware, safe subset only (spec 2026-07-21,
//    never-hallucinate layer 1) ──
const profile = (over: Partial<AccountConfigProfile> = {}): AccountConfigProfile => ({
  ...SAFE_PROFILE,
  ...over,
});

describe("selectMessageShape — signal-gated, config-aware champion default", () => {
  it("returns trigger_consequence when a real trigger is present, REGARDLESS of profile", () => {
    // a genuine why-now is the strongest opener and it is fully grounded, so no config overrides it.
    expect(selectMessageShape(insights({ triggers: ["closed a Series B"] }))).toBe(
      "trigger_consequence"
    );
    expect(
      selectMessageShape(insights({ triggers: ["closed a Series B"] }), profile({ trust: "high" }))
    ).toBe("trigger_consequence");
    expect(
      selectMessageShape(
        insights({ triggers: ["closed a Series B"] }),
        profile({ conversionStyle: "self_serve", hasArtifact: true })
      )
    ).toBe("trigger_consequence");
  });

  it("falls to the safe observation_question floor on thin signal (safe/default profile)", () => {
    expect(selectMessageShape(insights({ triggers: [] }))).toBe("observation_question");
    // whitespace-only triggers are not a signal
    expect(selectMessageShape(insights({ triggers: ["  ", ""] }))).toBe("observation_question");
  });

  it("treats ranker 'no signal' placeholders as NO trigger — config NEVER licenses a fact-asserting shape without its signal (spec invariant 3)", () => {
    // The AI rank can emit a filler token when it finds nothing — a placeholder must NOT be read as
    // a real trigger, even on a booking/self-serve profile that would otherwise prefer a strong opener.
    const placeholders = [
      ["none"],
      ["n/a"],
      ["N/A"],
      ["unknown"],
      ["No recent trigger"],
      ["No specific hiring or funding trigger found"],
    ];
    // a booking profile whose no-trigger default is observation_question — so if the placeholder
    // were (wrongly) read as a real trigger it would show up as trigger_consequence. It must not.
    const booking = profile({ conversionStyle: "booking", hasArtifact: true });
    for (const triggers of placeholders) {
      expect(
        selectMessageShape(insights({ triggers }), booking),
        `placeholder ${JSON.stringify(triggers)}`
      ).toBe("observation_question");
    }
  });

  it("still selects trigger_consequence for a REAL trigger that happens to start with 'no'/'now' (no false-drop)", () => {
    // isNoSignalToken must not swallow genuine triggers — "now hiring" and "no longer using X" are
    // real signals, not placeholders (the negation branch is scoped to sentences that name a trigger).
    expect(selectMessageShape(insights({ triggers: ["now hiring 5 reps"] }))).toBe(
      "trigger_consequence"
    );
    expect(selectMessageShape(insights({ triggers: ["no longer using Salesforce"] }))).toBe(
      "trigger_consequence"
    );
  });

  it("trust: high (no trigger) → observation_question and NEVER a gift/bold shape, even with an artifact", () => {
    // regulated sellers get the calm shape even with an artifact and a self-serve-ish arc.
    const high = profile({ trust: "high", conversionStyle: "self_serve", hasArtifact: true });
    expect(selectMessageShape(insights({ triggers: [] }), high)).toBe("observation_question");
  });

  it("self_serve + artifact (no trigger) → gift; self_serve without an artifact stays on the floor", () => {
    expect(
      selectMessageShape(
        insights({ triggers: [] }),
        profile({ conversionStyle: "self_serve", hasArtifact: true })
      )
    ).toBe("gift");
    expect(
      selectMessageShape(
        insights({ triggers: [] }),
        profile({ conversionStyle: "self_serve", hasArtifact: false })
      )
    ).toBe("observation_question");
  });

  it("traffic → gift when there is an artifact, else observation_question", () => {
    expect(
      selectMessageShape(
        insights({ triggers: [] }),
        profile({ conversionStyle: "traffic", hasArtifact: true })
      )
    ).toBe("gift");
    expect(
      selectMessageShape(
        insights({ triggers: [] }),
        profile({ conversionStyle: "traffic", hasArtifact: false })
      )
    ).toBe("observation_question");
  });

  it("booking/standard/no-trigger → observation_question (start a real conversation)", () => {
    expect(
      selectMessageShape(
        insights({ triggers: [] }),
        profile({ conversionStyle: "booking", hasArtifact: true })
      )
    ).toBe("observation_question");
  });

  it("NEVER auto-selects a bold shape and NEVER peer_insider, across every profile (undferivable signal)", () => {
    const cases: StoredInsights[] = [
      insights(),
      insights({ triggers: [] }),
      insights({ triggers: [], pain_points: [] }),
    ];
    const profiles: AccountConfigProfile[] = [
      SAFE_PROFILE,
      profile({ trust: "high" }),
      profile({ conversionStyle: "self_serve", hasArtifact: true }),
      profile({ conversionStyle: "traffic", hasArtifact: true }),
      profile({ conversionStyle: "booking" }),
      profile({ conversionStyle: "reply", hasArtifact: true }),
    ];
    for (const i of cases) {
      for (const p of profiles) {
        const shape = selectMessageShape(i, p);
        expect(BOLD_SHAPES).not.toContain(shape);
        expect(shape).not.toBe("peer_insider");
        expect(SAFE_SHAPES).toContain(shape);
      }
    }
  });

  it("no profile arg → SAFE_PROFILE default (trigger-or-floor, matching the pre-config selector)", () => {
    expect(selectMessageShape(insights())).toBe("trigger_consequence");
    expect(selectMessageShape(insights({ triggers: [] }))).toBe("observation_question");
  });
});

// ── groundingHasShapeSignal — deterministic grounding guard (spec §5c, never-hallucinate layer 3) ──
describe("groundingHasShapeSignal — guard on the leadBlock", () => {
  const base = {
    lead: { firstName: "Dana", lastName: "Reed", title: "VP Sales", companyName: "Acme", industry: "saas" },
    context: { cta: "a quick intro", accountName: "Vantera" },
  };

  it("passes trigger_consequence when the block carries a real trigger, flags it when it does not", () => {
    const withTrigger = leadBlock({ ...base, insights: insights({ triggers: ["hiring 3 SDRs"] }) });
    const noTrigger = leadBlock({ ...base, insights: insights({ triggers: [] }) });
    expect(groundingHasShapeSignal(withTrigger, "trigger_consequence")).toBe(true);
    // empty triggers render "Triggers: none observed" — NOT a real signal.
    expect(groundingHasShapeSignal(noTrigger, "trigger_consequence")).toBe(false);
  });

  it("flags trigger_consequence when the block's trigger line is a ranker placeholder (review I3)", () => {
    // A placeholder that survived into the block ("No specific trigger found" / "n/a") is NOT a real
    // signal — the guard must catch it just like the selector does, keeping the two consistent.
    for (const t of ["No specific hiring or funding trigger found", "n/a", "none", "No recent trigger"]) {
      const block = leadBlock({ ...base, insights: insights({ triggers: [t] }) });
      expect(groundingHasShapeSignal(block, "trigger_consequence"), `placeholder "${t}"`).toBe(false);
    }
  });

  it("keys on real content, not stray '; ' punctuation from empty array entries (review weakness)", () => {
    // triggers: ["", ""] renders "Triggers: ; " (join keeps the semicolon) — the OLD regex saw the
    // ';' as non-space and false-passed. The guard now splits and requires a real token.
    const strayOnly = leadBlock({ ...base, insights: insights({ triggers: ["", ""] }) });
    expect(groundingHasShapeSignal(strayOnly, "trigger_consequence")).toBe(false);
    // but a real token alongside an empty one still passes ("Triggers: ; hiring 3 SDRs").
    const strayPlusReal = leadBlock({ ...base, insights: insights({ triggers: ["", "hiring 3 SDRs"] }) });
    expect(groundingHasShapeSignal(strayPlusReal, "trigger_consequence")).toBe(true);
  });

  it("passes gift only when the block carries a supporting-content artifact", () => {
    const withArtifact = leadBlock({
      ...base,
      insights: insights(),
      context: { ...base.context, contentLinks: ["https://acme.com/teardown.pdf"] },
    });
    const noArtifact = leadBlock({ ...base, insights: insights() });
    expect(groundingHasShapeSignal(withArtifact, "gift")).toBe(true);
    expect(groundingHasShapeSignal(noArtifact, "gift")).toBe(false);
  });

  it("passes peer_insider only when the prospect's own 'What they do' line is grounded", () => {
    const withOffering = leadBlock({
      ...base,
      insights: insights({ prospect_offering: "runs an inbound-lead service for founders" }),
    });
    const noOffering = leadBlock({ ...base, insights: insights({ prospect_offering: undefined }) });
    expect(groundingHasShapeSignal(withOffering, "peer_insider")).toBe(true);
    expect(groundingHasShapeSignal(noOffering, "peer_insider")).toBe(false);
  });

  it("always passes observation_question and the bold shapes (they assert no specific prospect fact)", () => {
    const thin = leadBlock({ ...base, insights: insights({ triggers: [] }) });
    for (const shape of ["observation_question", ...BOLD_SHAPES] as MessageShape[]) {
      expect(groundingHasShapeSignal(thin, shape)).toBe(true);
    }
  });
});

// ── validateProposedShape — generator closed-set + bold-pin gate (spec §6/§7) ──
describe("validateProposedShape — generator enum gate", () => {
  it("drops an unknown value", () => {
    expect(validateProposedShape("banter", { allowBold: false })).toBeNull();
    expect(validateProposedShape(42, { allowBold: false })).toBeNull();
    expect(validateProposedShape(undefined, { allowBold: true })).toBeNull();
  });

  it("drops observation_question (proposing the default is a no-op challenger)", () => {
    expect(validateProposedShape("observation_question", { allowBold: true })).toBeNull();
  });

  it("passes a safe non-default shape for any account", () => {
    expect(validateProposedShape("trigger_consequence", { allowBold: false })).toBe("trigger_consequence");
    expect(validateProposedShape("peer_insider", { allowBold: false })).toBe("peer_insider");
    expect(validateProposedShape("gift", { allowBold: false })).toBe("gift");
  });

  it("gates bold shapes behind the account pin", () => {
    for (const bold of BOLD_SHAPES) {
      expect(validateProposedShape(bold, { allowBold: false })).toBeNull();
      expect(validateProposedShape(bold, { allowBold: true })).toBe(bold);
    }
  });

  it("high-trust excludes provocation/disqualifier even when bold-pinned (config-aware eligibility)", () => {
    expect(validateProposedShape("provocation", { allowBold: true, highTrust: true })).toBeNull();
    expect(validateProposedShape("disqualifier", { allowBold: true, highTrust: true })).toBeNull();
    // own_cold (an honest cold-open) is NOT excluded — a bold-pinned high-trust account can still get it
    expect(validateProposedShape("own_cold", { allowBold: true, highTrust: true })).toBe("own_cold");
    // safe shapes are unaffected by trust
    expect(validateProposedShape("gift", { allowBold: false, highTrust: true })).toBe("gift");
    expect(validateProposedShape("trigger_consequence", { allowBold: false, highTrust: true })).toBe(
      "trigger_consequence"
    );
  });

  it("standard trust with the bold pin still allows provocation/disqualifier", () => {
    expect(validateProposedShape("provocation", { allowBold: true, highTrust: false })).toBe(
      "provocation"
    );
    expect(validateProposedShape("disqualifier", { allowBold: true })).toBe("disqualifier");
  });
});

// ── the catalog itself ──
describe("SHAPE_DIRECTIVE / SHAPE_BUDGET catalog", () => {
  it("covers every shape with a dash-free directive (prompt prose primes output style)", () => {
    for (const shape of MESSAGE_SHAPES) {
      const d = SHAPE_DIRECTIVE[shape];
      expect(d.length).toBeGreaterThan(0);
      // no em/en dash, no doubled hyphen, no spaced-hyphen clause punctuation
      expect(d).not.toMatch(/[—–]|--|\s-\s/);
    }
  });

  it("makes every fact-asserting directive forbid inventing its premise (never-hallucinate layer 2)", () => {
    for (const shape of FACT_ASSERTING_SHAPES) {
      expect(SHAPE_DIRECTIVE[shape].toLowerCase()).toMatch(/never|do not|only/);
    }
  });

  it("keeps observation_question at today's 180/28 budget and gives the roomier shapes more space", () => {
    expect(SHAPE_BUDGET.observation_question).toEqual({ maxChars: 180, maxWords: 28 });
    expect(SHAPE_BUDGET.trigger_consequence.maxChars).toBeGreaterThan(180);
    expect(shapeBudget()).toEqual({ maxChars: 180, maxWords: 28 });
    expect(shapeBudget("trigger_consequence")).toEqual({ maxChars: 245, maxWords: 40 });
  });

  it("isMessageShape recognizes members and rejects non-members", () => {
    expect(isMessageShape("gift")).toBe(true);
    expect(isMessageShape("nope")).toBe(false);
    expect(isMessageShape(null)).toBe(false);
  });
});

describe("isNoSignalToken — placeholder trigger predicate (review I3)", () => {
  it("flags empties and ranker filler tokens", () => {
    for (const v of [
      "",
      "   ",
      "none",
      "None",
      "nothing",
      "n/a",
      "N/A",
      "na",
      "unknown",
      "tbd",
      "not sure",
      "not applicable",
      "No recent trigger",
      "No specific hiring or funding trigger found",
      "no notable signals",
    ]) {
      expect(isNoSignalToken(v), `"${v}"`).toBe(true);
    }
  });

  it("does NOT flag genuine triggers, including ones that start with 'no'/'now' (no false-drop)", () => {
    for (const v of [
      "hiring 3 SDRs",
      "closed a Series B",
      "now hiring",
      "no longer using Salesforce",
      "notable expansion into EMEA",
      "nonprofit arm launched",
    ]) {
      expect(isNoSignalToken(v), `"${v}"`).toBe(false);
    }
  });
});

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
  selectMessageShape,
  shapeBudget,
  validateProposedShape,
  type MessageShape,
} from "./shape";
import { leadBlock } from "./shared";
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

// ── selectMessageShape — signal-gated, safe subset only (spec §5a, never-hallucinate layer 1) ──
describe("selectMessageShape — signal-gated champion default", () => {
  it("returns trigger_consequence ONLY when a real trigger is present", () => {
    expect(selectMessageShape({ insights: insights({ triggers: ["closed a Series B"] }) })).toBe(
      "trigger_consequence"
    );
  });

  it("falls to the safe observation_question floor on thin signal (no trigger, no artifact)", () => {
    expect(selectMessageShape({ insights: insights({ triggers: [] }) })).toBe("observation_question");
    // whitespace-only triggers are not a signal
    expect(selectMessageShape({ insights: insights({ triggers: ["  ", ""] }) })).toBe(
      "observation_question"
    );
  });

  it("returns gift only when a real artifact is available AND there is no stronger trigger signal", () => {
    expect(
      selectMessageShape({ insights: insights({ triggers: [] }), artifactAvailable: true })
    ).toBe("gift");
    // a trigger outranks a gift (a why-now beats a give)
    expect(selectMessageShape({ insights: insights(), artifactAvailable: true })).toBe(
      "trigger_consequence"
    );
  });

  it("NEVER auto-selects a bold shape and NEVER auto-selects peer_insider (undferivable signal)", () => {
    const cases: StoredInsights[] = [
      insights(),
      insights({ triggers: [] }),
      insights({ triggers: [], pain_points: [] }),
    ];
    for (const i of cases) {
      for (const artifactAvailable of [true, false]) {
        const shape = selectMessageShape({ insights: i, artifactAvailable });
        expect(BOLD_SHAPES).not.toContain(shape);
        expect(shape).not.toBe("peer_insider");
        expect(SAFE_SHAPES).toContain(shape);
      }
    }
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

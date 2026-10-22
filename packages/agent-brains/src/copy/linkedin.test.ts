import { describe, expect, it } from "vitest";
import { MockLanguageModelV3 } from "ai/test";
import { fnv1a64 } from "@vantera/ai";
import { draftLinkedIn, validateLinkedInDraft, LINKEDIN_SYSTEM, CONNECTION_NOTE_MAX_CHARS } from "./linkedin";
import { leadBlock, strategyDirectives, type DraftInput } from "./shared";
import { validateHumanity } from "./humanizer";
import { MESSAGE_SHAPES, SHAPE_BUDGET, shapeBudget, type MessageShape } from "./shape";

const INPUT: DraftInput = {
  lead: { firstName: "Dana", title: "VP Sales", companyName: "Acme", industry: "saas" },
  insights: {
    pain_points: ["pipeline coverage"],
    triggers: ["hiring 3 SDRs"],
    motivations: ["hit growth targets"],
    value_angle: "fills top-of-funnel without headcount",
    aha_moment: "qualified meetings on the calendar in week one",
    summary: "Strong fit.",
  },
  context: { cta: "book a 15-min intro", valueProp: "SDR agents that source and outreach" },
};

const CLEAN = {
  connection_note:
    "Dana, noticed Acme is hiring three SDRs at once. Scaling outbound that fast is a ride, happy to swap notes from the builder side.",
  followup_message:
    "Thanks for connecting. When teams hire SDRs in batches, pipeline usually outruns ramp time. How are you keeping sourcing ahead of the new reps?",
};

function textResponse(json: unknown) {
  return {
    finishReason: { unified: "stop" as const, raw: "stop" },
    usage: { inputTokens: { total: 1, noCache: 1, cacheRead: 0, cacheWrite: 0 }, outputTokens: { total: 1, text: 1, reasoning: 0 } },
    content: [{ type: "text" as const, text: JSON.stringify(json) }],
    warnings: [],
  };
}

function sequence(...responses: ReturnType<typeof textResponse>[]) {
  let call = 0;
  return async () => responses[Math.min(call++, responses.length - 1)]!;
}

describe("validateLinkedInDraft", () => {
  it("generates connection notes to the 200-char free-tier cap (locked) so a reviewed note is sent verbatim, never truncated", () => {
    expect(CONNECTION_NOTE_MAX_CHARS).toBe(200);
  });

  it("accepts a clean draft", () => {
    expect(validateLinkedInDraft(CLEAN)).toEqual([]);
  });

  it("enforces the connection-note char ceiling", () => {
    const violations = validateLinkedInDraft({
      connection_note: "x".repeat(CONNECTION_NOTE_MAX_CHARS + 1),
      followup_message: "fine",
    });
    expect(violations.some((v) => v.rule === "length")).toBe(true);
  });

  it("flags a first DM that runs past the tightened 180-char / 28-word ceiling (too long)", () => {
    // A wordy first message, each word short enough to stay under a naive char cap — the word cap
    // is what catches it. This is the "initial outreach message is too long" fix (2026-07-10).
    const wordy = Array.from({ length: 40 }, (_, i) => `word${i % 9}`).join(" ");
    const violations = validateLinkedInDraft({ connection_note: "Hi Dana, fellow SaaS founder here.", followup_message: wordy });
    expect(violations.some((v) => v.rule === "length")).toBe(true);
  });

  it("rejects links in the connection note", () => {
    const violations = validateLinkedInDraft({
      connection_note: "Check https://example.com",
      followup_message: "fine",
    });
    expect(violations.some((v) => v.rule === "no-links")).toBe(true);
  });

  it("flags a metric claim not grounded in the lead facts", () => {
    const violations = validateLinkedInDraft(
      {
        connection_note: "Dana, saw Acme grew 40% last quarter, impressive.",
        followup_message: "Thanks for connecting. Worth a quick look?",
      },
      leadBlock(INPUT),
    );
    expect(violations.map((v) => v.rule)).toContain("ungrounded-claim");
  });

  it("flags an invented Series B as an ungrounded entity", () => {
    const violations = validateLinkedInDraft(
      {
        connection_note: "Dana, congrats on the Series B.",
        followup_message: "Thanks for connecting. How are you putting that capital to work?",
      },
      leadBlock(INPUT),
    );
    expect(violations.map((v) => v.rule)).toContain("ungrounded-entity");
  });
});

// ── message-shape selector: compliance is enforced regardless of shape (spec §2/§9) ──
// The seven representative drafts, one per shape, each dash-free, de-pitched, and inside its own
// budget. They are the "compliance survives every shape" fixture.
const SHAPE_DRAFTS: Record<MessageShape, { connection_note: string; followup_message: string }> = {
  observation_question: {
    connection_note: "Your work in outbound stood out, glad to connect.",
    followup_message:
      "Thanks for connecting. When pipeline leans on one person, sourcing eats the week. How are you splitting finding people from writing to them now?",
  },
  trigger_consequence: {
    connection_note: "Saw the hiring push, glad to connect.",
    followup_message:
      "Thanks for connecting. Saw you are hiring three reps. What bites is pipeline outrunning ramp, so new folks land with thin lists by month two. How are you keeping sourcing ahead of them? All good if timing is off.",
  },
  provocation: {
    connection_note: "Glad to connect with a fellow outbound builder.",
    followup_message:
      "Most outbound teams do not have a pipeline problem, they have a follow up problem. Bet your reps chase new names while the warm ones go cold.",
  },
  gift: {
    connection_note: "Your work in outbound stood out, glad to connect.",
    followup_message:
      "Thanks for connecting. One thing that helps teams like yours: when you sort replies by first line instead of subject, the openers that land jump out fast. Steal it, no ask here, just thought it was worth passing on.",
  },
  own_cold: {
    connection_note: "Glad to connect.",
    followup_message:
      "Full honesty, this is cold and I have not followed your work. The one reason I messaged: you run outbound somewhere small enough that sourcing and writing land on one desk. Curious how you juggle both.",
  },
  disqualifier: {
    connection_note: "Glad to connect.",
    followup_message:
      "Not for teams happy blasting a thousand cold notes a week. Worth a look only if you would rather send fifty sharp ones that get read. You might be the second kind.",
  },
  peer_insider: {
    connection_note: "Fellow list-wrangler, glad to connect.",
    followup_message:
      "Anyone who does this work knows the tax is not writing the notes, it is keeping the list fresh so you are not chasing people who changed jobs. How do you keep yours clean?",
  },
};

describe("validateLinkedInDraft — message-shape selector (spec 2026-07-20)", () => {
  it("every shape's representative draft passes validateLinkedInDraft + validateHumanity (compliance survives every shape)", () => {
    for (const shape of MESSAGE_SHAPES) {
      const draft = SHAPE_DRAFTS[shape];
      // no grounding here: this isolates compliance (humanity + de-pitch + the shape's own budget)
      const violations = validateLinkedInDraft(draft, undefined, "Vantera", shape);
      expect(violations, `${shape} compliance`).toEqual([]);
      // and the follow-up on its own is humanizer-clean at the shape's budget
      const budget = shapeBudget(shape);
      expect(validateHumanity(draft.followup_message, budget), `${shape} humanity`).toEqual([]);
    }
  });

  it("structure override is scoped: a product name / link / meeting ask in a shaped draft is STILL flagged (not a compliance hole)", () => {
    // a trigger_consequence-shaped message that pitches + asks for a call — compliance runs anyway.
    const pitchy = validateLinkedInDraft(
      {
        connection_note: "clean note",
        followup_message: "Saw you are hiring. Vantera can fix that fast. Grab a call this week?",
      },
      undefined,
      "Vantera",
      "trigger_consequence"
    );
    expect(pitchy.some((v) => v.rule === "no-product-pitch")).toBe(true);
    expect(pitchy.some((v) => v.rule === "no-meeting-ask")).toBe(true);
    // a gift-shaped message with a raw link is still flagged — the override never touches links.
    const linked = validateLinkedInDraft(
      { connection_note: "clean note", followup_message: "Steal this, it is all here https://example.com/x" },
      undefined,
      "Vantera",
      "gift"
    );
    expect(linked.some((v) => v.rule === "no-links")).toBe(true);
  });

  it("applies the per-shape length budget: a 220-char body passes trigger_consequence but fails observation_question", () => {
    const body =
      "Saw the funding news land and the team doubling, so the old sourcing motion cannot keep pace and pipeline quietly thins while everyone is busy hiring the next wave of reps into a very full quarter that keeps getting fuller.";
    expect(body.length).toBeGreaterThan(SHAPE_BUDGET.observation_question.maxChars);
    expect(body.length).toBeLessThanOrEqual(SHAPE_BUDGET.trigger_consequence.maxChars);
    const asTrigger = validateLinkedInDraft(
      { connection_note: "clean", followup_message: body },
      undefined,
      null,
      "trigger_consequence"
    );
    const asDefault = validateLinkedInDraft(
      { connection_note: "clean", followup_message: body },
      undefined,
      null,
      "observation_question"
    );
    expect(asTrigger.some((v) => v.rule === "length")).toBe(false);
    expect(asDefault.some((v) => v.rule === "length")).toBe(true);
  });
});

// ── anti-hallucination: the deterministic grounding guard (spec §5c) ──
describe("validateLinkedInDraft — grounding guard (fact-asserting shapes need their signal)", () => {
  const inputNoTrigger: DraftInput = { ...INPUT, insights: { ...INPUT.insights, triggers: [] } };

  it("flags a fact-asserting shape whose grounding signal is absent", () => {
    const block = leadBlock(inputNoTrigger); // renders "Triggers: none observed"
    const v = validateLinkedInDraft(CLEAN, block, null, "trigger_consequence");
    expect(v.some((x) => x.rule === "shape-signal-missing")).toBe(true);
  });

  it("does NOT flag the same shape when the grounding carries a real trigger", () => {
    const block = leadBlock(INPUT); // INPUT has triggers: ["hiring 3 SDRs"]
    const v = validateLinkedInDraft(CLEAN, block, null, "trigger_consequence");
    expect(v.some((x) => x.rule === "shape-signal-missing")).toBe(false);
  });

  it("never adds the guard for the observation_question default or an unset shape (byte-identical default)", () => {
    const block = leadBlock(inputNoTrigger);
    expect(validateLinkedInDraft(CLEAN, block, null, "observation_question").some((x) => x.rule === "shape-signal-missing")).toBe(false);
    expect(validateLinkedInDraft(CLEAN, block).some((x) => x.rule === "shape-signal-missing")).toBe(false);
  });
});

// ── byte-identical default: unset ≡ observation_question at the draftLinkedIn level (spec §9.1) ──
function capturingModel() {
  const seen: string[] = [];
  const model = new MockLanguageModelV3({
    doGenerate: async (options: { prompt: unknown }) => {
      seen.push(JSON.stringify(options.prompt));
      return textResponse(CLEAN);
    },
  });
  return { model, seen };
}

describe("draftLinkedIn — byte-identical default (feature OFF by default)", () => {
  it("unset and messageShape='observation_question' render the identical model prompt and identical draft", async () => {
    const unset = capturingModel();
    const d1 = await draftLinkedIn(INPUT, unset.model);

    const oq = capturingModel();
    const d2 = await draftLinkedIn(
      { ...INPUT, context: { ...INPUT.context, strategy: { messageShape: "observation_question" } } },
      oq.model
    );

    // the exact bytes the model saw (system + user prompt) are identical
    expect(oq.seen[0]).toBe(unset.seen[0]);
    // and the produced drafts are identical
    expect(d2).toEqual(d1);
    // exactly one generation each — no shape directive was appended, so nothing to fix/regenerate
    expect(unset.seen).toHaveLength(1);
    expect(oq.seen).toHaveLength(1);
  });
});

// ── review I2: the LINKEDIN_SYSTEM base prompt is SHAPE-CONDITIONAL, so the OFF path is truly
//    byte-identical (base prompt + hash) to before the message-shape feature existed. ──
describe("LINKEDIN_SYSTEM — byte-identical base prompt when the feature is off (review I2)", () => {
  // The FNV-1a 64-bit hash of the assembled LINKEDIN_SYSTEM text at commit c4261053~2 — the last
  // revision BEFORE the message-shape feature added its two lines to the base prompt. Recovered from
  // git and pinned here: if any shape/escape-hatch language leaks back into the BASE prompt, this
  // hash shifts and this test fails (and every champion's stamped promptHash would silently drift).
  const PRE_FEATURE_LINKEDIN_HASH = "85072182e5f97d23";

  it("LINKEDIN_SYSTEM.hash equals the pre-feature hash (true old == new)", () => {
    expect(LINKEDIN_SYSTEM.hash).toBe(PRE_FEATURE_LINKEDIN_HASH);
    // and the hash is genuinely the hash of the live text (guards against a stale pin)
    expect(fnv1a64(LINKEDIN_SYSTEM.text)).toBe(PRE_FEATURE_LINKEDIN_HASH);
  });

  it("the base prompt carries the ORIGINAL default-shape line and NONE of the feature escape-hatch language", () => {
    expect(LINKEDIN_SYSTEM.text).toContain(
      "- Shape: a brief thanks (3 to 6 words, not gushing), then ONE sharp observation"
    );
    // the two lines the feature had added to the base prompt must be gone from the base
    expect(LINKEDIN_SYSTEM.text).not.toContain("Default shape, UNLESS");
    expect(LINKEDIN_SYSTEM.text).not.toContain("Whatever the shape");
    expect(LINKEDIN_SYSTEM.text).not.toContain("message shape directive");
  });
});

// ── review I2: the compliance escape-hatch appears ONLY when a non-default shape is applied ──
describe("strategyDirectives / draftLinkedIn — shape-conditional escape hatch (review I2)", () => {
  const OVERRIDE_MARK = "This changes the STRUCTURE of the message only, never what you may claim.";

  it("no shape / observation_question ⇒ the override language is NOT emitted", () => {
    expect(strategyDirectives()).not.toContain(OVERRIDE_MARK);
    expect(strategyDirectives({})).not.toContain(OVERRIDE_MARK);
    expect(strategyDirectives({ messageShape: "observation_question" })).not.toContain(OVERRIDE_MARK);
  });

  it("a non-default shape ⇒ the override language + de-pitch/voice guarantee appears", () => {
    const d = strategyDirectives({ messageShape: "trigger_consequence" });
    expect(d).toContain(OVERRIDE_MARK);
    expect(d).toContain("de-pitch rules (no product name, no link, no meeting ask)");
    // dash-free ADDED sentence (the "- " bullet prefix is legitimate list syntax, so check only the
    // override sentence itself — prompt prose primes output style; the humanizer bans dashes downstream)
    expect(OVERRIDE_MARK).not.toMatch(/[—–]|--|\s-\s/);
  });

  it("draftLinkedIn injects the override into the model prompt only for a non-default shape", async () => {
    const off = capturingModel();
    await draftLinkedIn(INPUT, off.model);
    expect(off.seen[0]).not.toContain(OVERRIDE_MARK);

    const on = capturingModel();
    await draftLinkedIn(
      { ...INPUT, context: { ...INPUT.context, strategy: { messageShape: "trigger_consequence" } } },
      on.model
    );
    expect(on.seen[0]).toContain(OVERRIDE_MARK);
  });
});

describe("draftLinkedIn", () => {
  it("returns both messages with no violations for clean output", async () => {
    const model = new MockLanguageModelV3({ doGenerate: textResponse(CLEAN) });

    const draft = await draftLinkedIn(INPUT, model);

    expect(draft.connectionNote).toBe(CLEAN.connection_note);
    expect(draft.followupMessage).toBe(CLEAN.followup_message);
    expect(draft.violations).toEqual([]);
  });

  it("regenerates once on style violations", async () => {
    const sloppy = {
      connection_note: "I hope this finds you well! Big fan of Acme!",
      followup_message: CLEAN.followup_message,
    };
    const model = new MockLanguageModelV3({
      doGenerate: sequence(textResponse(sloppy), textResponse(CLEAN)),
    });

    const draft = await draftLinkedIn(INPUT, model);

    expect(model.doGenerateCalls).toHaveLength(2);
    expect(draft.violations).toEqual([]);
  });
});

describe("validateLinkedInDraft — follow-up link guard", () => {
  it("rejects a link in the first follow-up (anti-pitch, soft ask)", () => {
    const violations = validateLinkedInDraft({
      connection_note: "Dana, clean note, no pitch.",
      followup_message: "Thanks for connecting. See a demo: https://example.com/demo",
    });
    expect(violations.some((v) => v.rule === "no-links")).toBe(true);
  });
});

describe("validateLinkedInDraft — de-pitched first touch (2026-07-08)", () => {
  it("flags the product name in the first message — touch 1 earns a conversation, never sells", () => {
    const violations = validateLinkedInDraft(
      {
        connection_note: "Your PMO work in Doha stood out.",
        followup_message: "Thanks for connecting. Vantera finds in-market buyers for you.",
      },
      undefined,
      "Vantera"
    );
    expect(violations.some((v) => v.rule === "no-product-pitch")).toBe(true);
  });

  it("flags a call/meeting ask in the first message — the question IS the CTA", () => {
    const violations = validateLinkedInDraft({
      connection_note: "Sharp take on churn.",
      followup_message: "Thanks for connecting. Would a quick call make sense this week?",
    });
    expect(violations.some((v) => v.rule === "no-meeting-ask")).toBe(true);
  });

  it("accepts a question-led, pitch-free first message", () => {
    const violations = validateLinkedInDraft(
      {
        connection_note: "Your PMO work in Doha stood out.",
        followup_message: "Thanks for connecting. When pipeline depends on you alone, what eats more hours: finding the right people or writing to them?",
      },
      undefined,
      "Vantera"
    );
    expect(violations).toEqual([]);
  });
});

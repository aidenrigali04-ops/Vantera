import { describe, expect, it } from "vitest";
import { validateHumanity, findRestartPhrases } from "./humanizer";

const CLEAN_EMAIL = `Saw you're hiring three SDRs while running outbound yourself. That usually means pipeline is outgrowing the team.

We put an SDR agent on top of your CRM so qualified meetings land on the calendar before the new hires even ramp.

Worth a look at how that works for Acme?`;

describe("validateHumanity", () => {
  it("passes clean, human-sounding copy", () => {
    expect(validateHumanity(CLEAN_EMAIL, { maxWords: 90 })).toEqual([]);
  });

  it.each([
    ["i hope this finds you well", "I hope this finds you well, Dana."],
    ["i wanted to reach out", "I wanted to reach out about your stack."],
    ["game-changer", "Our tool is a game-changer for sales."],
    ["big fan of", "Big fan of what you built at Acme."],
    ["just checking in", "Just checking in on my last note."],
  ])("flags the banned phrase %s", (_phrase, text) => {
    const violations = validateHumanity(text);
    expect(violations.some((v) => v.rule === "banned-phrase")).toBe(true);
  });

  it("flags em-dash chains but allows a single em-dash", () => {
    expect(validateHumanity("One thought — worth a look.")).toEqual([]);
    expect(
      validateHumanity("One thought — worth a look — let me know — anytime.").some(
        (v) => v.rule === "em-dashes"
      )
    ).toBe(true);
  });

  it("flags multiple exclamation marks", () => {
    expect(validateHumanity("Great news! Big launch!").some((v) => v.rule === "exclamations")).toBe(true);
  });

  it("flags hedge-word pileups but tolerates two", () => {
    expect(validateHumanity("Maybe worth a look. Just a thought.")).toEqual([]);
    expect(
      validateHumanity("Just a thought, maybe, perhaps we could talk.").some((v) => v.rule === "hedging")
    ).toBe(true);
  });

  it('flags the "As a/an" opener', () => {
    expect(validateHumanity("As a founder, you know churn hurts.").some((v) => v.rule === "opener")).toBe(true);
  });

  it("enforces word and char caps", () => {
    expect(validateHumanity("one two three four", { maxWords: 3 }).some((v) => v.rule === "length")).toBe(true);
    expect(validateHumanity("x".repeat(301), { maxChars: 300 }).some((v) => v.rule === "length")).toBe(true);
  });
});

describe("validateHumanity — expanded slop + dashes", () => {
  it.each([
    ["quick question", "Quick question about your outbound."],
    ["move the needle", "This will move the needle on pipeline."],
    ["world-class", "We built a world-class team here."],
    ["touch base", "Wanted to touch base on my note."],
  ])("flags additional slop phrase %s", (_p, text) => {
    expect(validateHumanity(text).some((v) => v.rule === "banned-phrase")).toBe(true);
  });

  it("counts en-dashes as dash slop, not just em-dashes", () => {
    expect(
      validateHumanity("One – two – three – four.").some((v) => v.rule === "em-dashes")
    ).toBe(true);
  });

  it("keeps a genuine, personalized message clean", () => {
    expect(
      validateHumanity("Saw Acme is hiring three SDRs. Worth a look at how meetings land before they ramp?")
    ).toEqual([]);
  });
});

describe("findRestartPhrases", () => {
  it("flags a mid-conversation re-introduction / cold-open", () => {
    expect(findRestartPhrases("Wanted to connect and share what we do.").some((v) => v.rule === "restart")).toBe(true);
    expect(findRestartPhrases("Saw you reacted to my post, thoughts?").some((v) => v.rule === "restart")).toBe(true);
    expect(findRestartPhrases("Let me introduce what we do at Vantera.").some((v) => v.rule === "restart")).toBe(true);
  });

  it("passes a normal in-thread reply — including a 'quick intro' CTA", () => {
    expect(findRestartPhrases("Totally fair. The qualify step is the difference; open to a quick intro?")).toEqual([]);
  });
});

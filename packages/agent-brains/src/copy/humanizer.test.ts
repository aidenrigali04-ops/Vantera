import { describe, expect, it } from "vitest";
import { validateHumanity, findRestartPhrases, findActionClaims, findUnapprovedLinks } from "./humanizer";

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

  it("flags ANY dash used as punctuation (zero tolerance, 2026-07-08)", () => {
    expect(validateHumanity("One thought — worth a look.").some((v) => v.rule === "dashes")).toBe(true);
    expect(validateHumanity("One thought -- worth a look.").some((v) => v.rule === "dashes")).toBe(true);
    expect(validateHumanity("One thought - worth a look.").some((v) => v.rule === "dashes")).toBe(true);
  });

  it("keeps hyphenated words and URLs legal under the dash rule", () => {
    expect(validateHumanity("Open to a 15-min look at how co-founders handle this?")).toEqual([]);
    expect(
      validateHumanity("grab a slot: https://cal.com/aiden--team/15min").filter((v) => v.rule === "dashes")
    ).toEqual([]);
  });

  it("flags semicolons and list formatting as machine voice", () => {
    expect(validateHumanity("Fair point; the qualify step differs.").some((v) => v.rule === "semicolon")).toBe(true);
    expect(validateHumanity("Two things:\n- speed\n- quality").some((v) => v.rule === "list-format")).toBe(true);
    expect(validateHumanity("Two things:\n1. speed\n2. quality").some((v) => v.rule === "list-format")).toBe(true);
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
      validateHumanity("One – two – three – four.").some((v) => v.rule === "dashes")
    ).toBe(true);
  });

  it.each([
    ["i'm reaching out", "I'm reaching out because your post stood out."],
    ["leverage", "You could leverage the new team for outbound."],
    ["delve", "Happy to delve into the details."],
    ["thrilled", "Thrilled to see the Series A news."],
    ["caught my eye", "Your growth caught my eye."],
    ["feel free to", "Feel free to ping me anytime."],
  ])("flags the 2026-07-08 AI-tell vocabulary: %s", (_p, text) => {
    expect(validateHumanity(text).some((v) => v.rule === "banned-phrase")).toBe(true);
  });

  it("matches banned phrases through curly apostrophes", () => {
    expect(validateHumanity("Don’t hesitate to reach back.").some((v) => v.rule === "banned-phrase")).toBe(true);
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

describe("findActionClaims", () => {
  it("flags completed platform actions the agent cannot perform", () => {
    expect(findActionClaims("That's kind — just joined.")).toHaveLength(1);
    expect(findActionClaims("I've signed up for the beta")).toHaveLength(1);
    expect(findActionClaims("I have subscribed to your newsletter")).toHaveLength(1);
  });

  it("never flags observation or future-tense phrasing", () => {
    expect(findActionClaims("Saw your post on churn — sharp take.")).toHaveLength(0);
    expect(findActionClaims("Happy to take a look when it ships.")).toHaveLength(0);
    expect(findActionClaims("I noticed you're hiring SDRs.")).toHaveLength(0);
  });
});

describe("findUnapprovedLinks", () => {
  it("allows whitelisted links (booking + content) and flags everything else", () => {
    const allowed = ["https://cal.com/aiden/15min", "https://vantera.dev/one-pager"];
    expect(findUnapprovedLinks("grab a slot: https://cal.com/aiden/15min", allowed)).toHaveLength(0);
    expect(findUnapprovedLinks("see https://cal.com/aiden/15min?d=30.", allowed)).toHaveLength(0);
    const flagged = findUnapprovedLinks("check https://random-site.io/pricing", allowed);
    expect(flagged).toHaveLength(1);
    expect(flagged[0]!.rule).toBe("unapproved-link");
  });

  it("flags every link when nothing is whitelisted", () => {
    expect(findUnapprovedLinks("https://cal.com/x", [])).toHaveLength(1);
  });
});

import { describe, expect, it } from "vitest";
import { validateHumanity, findRestartPhrases, findActionClaims, findUnapprovedLinks, findSpeculativeClaims, findParrotOpener, normalizeDashes } from "./humanizer";

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

describe("findSpeculativeClaims", () => {
  it("flags mind-reading about the prospect's state", () => {
    expect(findSpeculativeClaims("Makes sense, you're probably swamped with hiring right now.")).toHaveLength(1);
    expect(findSpeculativeClaims("You must be dealing with a lot of unqualified leads.")).toHaveLength(1);
    expect(findSpeculativeClaims("I imagine your team is stretched thin.")).toHaveLength(1);
    expect(findSpeculativeClaims("Sounds like you're buried in outreach.")).toHaveLength(1);
    expect(findSpeculativeClaims("I bet you're seeing low reply rates.")).toHaveLength(1);
  });

  it("does not flag grounded statements, conditionals, or plain concessions", () => {
    expect(findSpeculativeClaims("If you're seeing low reply rates, that's the qualify gap.")).toHaveLength(0);
    expect(findSpeculativeClaims("You're probably right about that.")).toHaveLength(0);
    expect(findSpeculativeClaims("It flags the leads worth a rep's time before you reach out.")).toHaveLength(0);
    expect(findSpeculativeClaims("You might want to check the pipeline view.")).toHaveLength(0);
  });
});

describe("findParrotOpener", () => {
  const incoming = "Honestly our reps waste hours chasing unqualified leads every week.";

  it("flags a validation opener that restates the prospect's own point", () => {
    expect(findParrotOpener("That makes sense, chasing unqualified leads wastes so many hours.", incoming)).toHaveLength(1);
    expect(findParrotOpener("Totally fair, unqualified leads really do waste rep hours.", incoming)).toHaveLength(1);
  });

  it("does not flag a substantive answer, a bare ack, or a keyword-reuse answer", () => {
    // substantive, no validation frame:
    expect(findParrotOpener("We flag the leads worth a rep's time before you ever reach out.", incoming)).toHaveLength(0);
    // validation frame but no echo of their content words:
    expect(findParrotOpener("Totally fair. Want a quick look at how it works?", incoming)).toHaveLength(0);
    // answers using one shared keyword, no validation frame:
    expect(findParrotOpener("The qualify step is exactly what stops reps chasing bad leads.", incoming)).toHaveLength(0);
  });

  it("is a no-op in follow-up mode (no incoming message)", () => {
    expect(findParrotOpener("That makes sense, unqualified leads waste hours.", undefined)).toHaveLength(0);
    expect(findParrotOpener("That makes sense, unqualified leads waste hours.", "")).toHaveLength(0);
  });
});

describe("normalizeDashes", () => {
  it("turns em/en dashes and spaced hyphens used as punctuation into commas", () => {
    expect(normalizeDashes("great, I love it — worth a look?")).toBe("great, I love it, worth a look?");
    expect(normalizeDashes("yes—exactly what we do")).toBe("yes, exactly what we do");
    expect(normalizeDashes("it works - most of the time")).toBe("it works, most of the time");
    expect(normalizeDashes("two things -- speed and fit")).toBe("two things, speed and fit");
    // and the result is clean per the linter
    expect(validateHumanity(normalizeDashes("good news — it shipped")).some((v) => v.rule === "dashes")).toBe(false);
  });

  it("never touches hyphens inside words, prices, or numeric ranges", () => {
    expect(normalizeDashes("our co-founder ran a 15-min demo")).toBe("our co-founder ran a 15-min demo");
    expect(normalizeDashes("pricing is $2-4k per month")).toBe("pricing is $2-4k per month");
    expect(normalizeDashes("we get you 10–20 leads")).toBe("we get you 10–20 leads");
    expect(normalizeDashes("a range of 10 - 20 works")).toBe("a range of 10 - 20 works");
  });
});

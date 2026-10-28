import { describe, expect, it } from "vitest";
import { lintForMove, type LintContext } from "./lint";
import { emptyState, type ConversationState } from "./state";
import type { Style } from "./moves";

const style: Style = { lengthBand: "short", question: true, link: "none", mirror: false };
const BOOK = "https://cal.com/acme/intro";
const SITE = "https://acme.io";

function ctx(over: Partial<LintContext> & { state?: ConversationState } = {}): LintContext {
  return {
    move: "ask_discovery",
    style,
    state: emptyState(),
    sellerName: "Vantera",
    identity: "Ryan Northwind",
    avoidSkeletons: [],
    allowedLinks: [BOOK, SITE],
    linkKinds: ["booking", "website"],
    ...over,
  };
}
const rules = (m: string, c: LintContext) => lintForMove(m, c).map((v) => v.rule);
const withHook = (text: string): ConversationState => {
  const s = emptyState();
  s.memory.hooksUsed.push({ kind: "trigger", text, messageRef: "m1" });
  return s;
};

describe("lintForMove", () => {
  it("passes a clean message", () => {
    expect(lintForMove("How do you handle your hiring pipeline today?", ctx())).toEqual([]);
  });

  it("flags a second opener whose skeleton matches a hook already used", () => {
    const state = withHook("Saw you just raised a Series A round");
    expect(rules("Saw you just raised a Series A, what are you hiring for?", ctx({ state }))).toContain("second-opener");
    expect(rules("Anything on your plate right now?", ctx({ state }))).not.toContain("second-opener");
    expect(rules("Saw you just raised a Series A, you hiring?", ctx({ avoidSkeletons: ["saw you just raised a"] }))).toContain("second-opener");
  });

  it("flags a reused hook text (case/punctuation-insensitive)", () => {
    const state = withHook("Ryan's team just raised a Series A");
    expect(rules("Big news: RYAN'S team just raised a Series A!! Do you plan to hire?", ctx({ state, identity: "" }))).toContain("hook-reuse");
    const short = withHook("Series A");
    expect(rules("Series A is exciting for you.", ctx({ state: short }))).not.toContain("hook-reuse");
  });

  it("flags pitch words before exploring; allows them after", () => {
    for (const m of ["Vantera helps you a lot.", "Our platform fits you.", "You get ROI fast.", "AI works for you.", "It is all-in-one for you.", "You gain 40% more."])
      expect(rules(m, ctx())).toContain("pitch-before-exploring");
    const exploring = emptyState();
    exploring.memory.problemsStated.push("slow hiring");
    expect(rules("Vantera helps you a lot.", ctx({ state: exploring }))).not.toContain("pitch-before-exploring");
  });

  it("flags bump phrases", () => {
    for (const m of ["Any thoughts? You there?", "Just following up for you.", "Never heard back from you.", "Circling back to you.", "Bubbling this up for you.", "Just checking in with you.", "Bumping this for you."])
      expect(rules(m, ctx())).toContain("bump-phrase");
  });

  it("flags >1 question, and any question when style.question=false", () => {
    expect(rules("Do you hire? Do you scale?", ctx())).toContain("too-many-questions");
    expect(rules("Do you hire?", ctx({ style: { ...style, question: false } }))).toContain("question-not-allowed");
    expect(rules("Do you hire?", ctx())).not.toContain("question-not-allowed");
  });

  it("flags pronoun imbalance", () => {
    expect(rules("We think we can help.", ctx())).toContain("pronoun-balance");
    expect(rules("I think I know, I did it, you see.", ctx())).toContain("pronoun-balance");
    expect(rules("That is a nice office.", ctx())).toContain("pronoun-balance");
    expect(rules("We can help you.", ctx())).not.toContain("pronoun-balance");
  });

  it("flags a message over its length band", () => {
    const long = `You ${"x".repeat(250)}`;
    expect(rules(long, ctx())).toContain("length-band");
    expect(rules(long, ctx({ style: { ...style, lengthBand: "standard" } }))).not.toContain("length-band");
  });

  it("flags a link whose kind differs from style.link", () => {
    expect(rules(`Book here: ${BOOK}`, ctx())).toContain("link-not-allowed");
    expect(rules(`Book here: ${BOOK}`, ctx({ style: { ...style, link: "website" } }))).toContain("link-not-allowed");
    expect(rules(`Book here, you: ${BOOK}.`, ctx({ style: { ...style, link: "booking" } }))).not.toContain("link-not-allowed");
    expect(rules(`See ${SITE}/ you`, ctx({ style: { ...style, link: "website" } }))).not.toContain("link-not-allowed");
  });

  it("flags a tentative label once one has been used", () => {
    const state = emptyState();
    expect(rules("It sounds like you are busy.", ctx({ state }))).not.toContain("label-overuse");
    state.counters.labelsUsed = 1;
    expect(rules("It sounds like you are busy.", ctx({ state }))).toContain("label-overuse");
  });

  it("pronoun-balance is skipped for non-English registers", () => {
    const es = emptyState();
    es.person.register.language = "es";
    expect(rules("Es una buena oficina.", ctx({ state: es }))).not.toContain("pronoun-balance");
    const en = emptyState();
    en.person.register.language = "en";
    expect(rules("Es una buena oficina.", ctx({ state: en }))).toContain("pronoun-balance");
  });

  it("the you/your arm is exempt for short moves but caps still apply", () => {
    expect(rules("That is a nice office.", ctx({ move: "answer" }))).not.toContain("pronoun-balance");
    expect(rules("That is a nice office.", ctx({ move: "observe" }))).toContain("pronoun-balance");
    expect(rules("We think we can do it.", ctx({ move: "answer" }))).toContain("pronoun-balance");
  });

  it("pitch-before-exploring exempts answer but not observe", () => {
    const engaged = emptyState();
    engaged.counters.leadTurns = 1;
    expect(rules("Vantera qualifies leads for you.", ctx({ move: "answer", state: engaged }))).not.toContain("pitch-before-exploring");
    expect(rules("Vantera qualifies leads for you.", ctx({ move: "observe", state: engaged }))).toContain("pitch-before-exploring");
  });

  it("URL query strings do not count as questions", () => {
    const m = `Is this useful to you? ${BOOK}?month=2026-11`;
    const c = ctx({ style: { ...style, link: "booking" } });
    expect(rules(m, c)).not.toContain("too-many-questions");
    expect(rules(`Useful to you? ${BOOK}?month=2026-11`, { ...c, style: { ...c.style, question: false } })).toContain("question-not-allowed");
    expect(rules(`See ${BOOK}?month=2026-11 for you.`, { ...c, style: { ...c.style, question: false } })).not.toContain("question-not-allowed");
  });

  it("link kinds: default order fallback, content kind, unlisted URL", () => {
    const noKinds = ctx({ linkKinds: undefined, style: { ...style, link: "booking" } });
    expect(rules(`Book you: ${BOOK}`, noKinds)).not.toContain("link-not-allowed");
    expect(rules(`See you: ${SITE}`, noKinds)).toContain("link-not-allowed");
    expect(rules(`See you: ${SITE}`, { ...noKinds, style: { ...style, link: "website" } })).not.toContain("link-not-allowed");
    const content = ctx({ allowedLinks: [BOOK, "https://acme.io/post"], linkKinds: ["booking", "content"], style: { ...style, link: "content" } });
    expect(rules("Read this, you: https://acme.io/post", content)).not.toContain("link-not-allowed");
    expect(rules(`Book you: ${BOOK}`, content)).toContain("link-not-allowed");
    expect(rules("See you: https://evil.example/x", content)).toContain("link-not-allowed");
  });
});

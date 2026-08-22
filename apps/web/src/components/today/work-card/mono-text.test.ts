import { describe, expect, it } from "vitest";
import { splitMono } from "./mono-text";

describe("splitMono", () => {
  it("returns a single plain part when there are no brackets", () => {
    expect(splitMono("approvals open")).toEqual([{ text: "approvals open", mono: false }]);
  });

  it("splits a bracketed fragment out as mono, keeping surrounding text", () => {
    expect(splitMono("next send ‹2:10pm› via Anna K.")).toEqual([
      { text: "next send ", mono: false },
      { text: "2:10pm", mono: true },
      { text: " via Anna K.", mono: false },
    ]);
  });

  it("handles multiple fragments and adjacent fragments", () => {
    expect(splitMono("today ‹12› of ‹45›")).toEqual([
      { text: "today ", mono: false },
      { text: "12", mono: true },
      { text: " of ", mono: false },
      { text: "45", mono: true },
    ]);
    expect(splitMono("‹8:00am›‹–5:00pm›")).toEqual([
      { text: "8:00am", mono: true },
      { text: "–5:00pm", mono: true },
    ]);
  });

  it("treats a fragment at the very start or end correctly", () => {
    expect(splitMono("‹3› drafts held")).toEqual([
      { text: "3", mono: true },
      { text: " drafts held", mono: false },
    ]);
    expect(splitMono("window closed until ‹8:00am›")).toEqual([
      { text: "window closed until ", mono: false },
      { text: "8:00am", mono: true },
    ]);
  });

  it("drops empty fragments and keeps an unmatched ‹ as plain text", () => {
    expect(splitMono("Paused by you ‹›")).toEqual([{ text: "Paused by you ", mono: false }]);
    expect(splitMono("odd ‹ bracket")).toEqual([{ text: "odd ‹ bracket", mono: false }]);
  });

  it("returns no parts for an empty string", () => {
    expect(splitMono("")).toEqual([]);
  });
});

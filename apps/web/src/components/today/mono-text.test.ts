import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { MonoText, splitMono } from "./mono-text";

describe("splitMono", () => {
  it("returns a single plain part when there are no delimiters", () => {
    expect(splitMono("sending paused · approvals stay open")).toEqual([
      { text: "sending paused · approvals stay open", mono: false },
    ]);
  });

  it("splits ‹…› fragments into mono parts, dropping the delimiters", () => {
    expect(splitMono("top score ‹84› · first sends ‹2:10–4:30pm› via Anna K.")).toEqual([
      { text: "top score ", mono: false },
      { text: "84", mono: true },
      { text: " · first sends ", mono: false },
      { text: "2:10–4:30pm", mono: true },
      { text: " via Anna K.", mono: false },
    ]);
  });

  it("handles a string that starts and ends with mono fragments", () => {
    expect(splitMono("‹3› interested · oldest ‹5h›")).toEqual([
      { text: "3", mono: true },
      { text: " interested · oldest ", mono: false },
      { text: "5h", mono: true },
    ]);
  });

  it("never emits empty parts", () => {
    expect(splitMono("")).toEqual([]);
    expect(splitMono("‹›")).toEqual([]);
    expect(splitMono("‹a›‹b›")).toEqual([
      { text: "a", mono: true },
      { text: "b", mono: true },
    ]);
  });

  it("is lenient with unbalanced delimiters", () => {
    expect(splitMono("paused ‹8:04am")).toEqual([
      { text: "paused ", mono: false },
      { text: "8:04am", mono: true },
    ]);
    expect(splitMono("stray › bracket")).toEqual([{ text: "stray  bracket", mono: false }]);
  });
});

describe("MonoText", () => {
  it("renders mono fragments in font-mono spans and plain text bare", () => {
    const html = renderToStaticMarkup(createElement(MonoText, { text: "failed ‹Aug 19› · sending pauses ‹Aug 26›" }));
    expect(html).toBe('failed <span class="font-mono">Aug 19</span> · sending pauses <span class="font-mono">Aug 26</span>');
  });

  it("renders plain strings without any wrapper", () => {
    expect(renderToStaticMarkup(createElement(MonoText, { text: "approvals still open" }))).toBe("approvals still open");
  });

  it("wraps in a span when a className is given and forwards monoClassName", () => {
    const html = renderToStaticMarkup(
      createElement(MonoText, { text: "‹12› drafts", className: "truncate", monoClassName: "text-[var(--ink)]" }),
    );
    expect(html).toBe('<span class="truncate"><span class="font-mono text-[var(--ink)]">12</span> drafts</span>');
  });

  it("renders nothing for an empty string", () => {
    expect(renderToStaticMarkup(createElement(MonoText, { text: "" }))).toBe("");
  });
});

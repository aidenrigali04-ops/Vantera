import { describe, expect, it } from "vitest";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { ScoreBadge, WhyNowCellView } from "./lead-why-now";

const lit = (html: string) => (html.match(/data-lit="true"/g) ?? []).length;
const bars = (html: string) => (html.match(/data-bar=/g) ?? []).length;

describe("ScoreBadge tier glyph", () => {
  it.each([
    [91, 3],
    [75, 2],
    [40, 1],
    [null, 0],
  ] as const)("score %s lights %i of 3 bars", (score, expected) => {
    const html = renderToStaticMarkup(createElement(ScoreBadge, { score, glyph: true }));
    expect(bars(html)).toBe(3);
    expect(lit(html)).toBe(expected);
  });

  it("keeps the number next to the glyph", () => {
    const html = renderToStaticMarkup(createElement(ScoreBadge, { score: 91, glyph: true }));
    expect(html).toContain(">91<");
  });

  it("is glyph-free by default (hot strip, dashboard, approvals unchanged)", () => {
    const html = renderToStaticMarkup(createElement(ScoreBadge, { score: 91 }));
    expect(bars(html)).toBe(0);
    expect(html).toContain("91");
  });
});

describe("WhyNowCellView", () => {
  const base = { label: "Raised a Series B", when: "3d ago", href: null, kind: "funding", level: null, more: 0 };

  it("leads with label · when", () => {
    const html = renderToStaticMarkup(createElement(WhyNowCellView, { cell: base }));
    expect(html).toContain("Raised a Series B");
    expect(html).toContain(" · 3d ago");
    expect(html).not.toContain("<a ");
    expect(html).not.toContain("+");
  });

  it("links the post title when there is an href, and shows +N", () => {
    const html = renderToStaticMarkup(
      createElement(WhyNowCellView, {
        cell: { ...base, href: "https://www.linkedin.com/feed/update/1", more: 2 },
        postTitle: "Hiring 3 SDRs",
      })
    );
    expect(html).toContain('href="https://www.linkedin.com/feed/update/1"');
    expect(html).toContain('rel="noreferrer"');
    expect(html).toContain("Hiring 3 SDRs");
    expect(html).toContain("+2");
  });

  it("renders nothing for a null cell", () => {
    expect(renderToStaticMarkup(createElement(WhyNowCellView, { cell: null }))).toBe("");
  });
});

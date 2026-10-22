import { describe, expect, it } from "vitest";
import type { Block } from "@/lib/blog";
import { TAKEAWAYS_ID, outlineArticle, slugify } from "./outline";

describe("slugify", () => {
  it("turns a heading into lowercase words joined by hyphens", () => {
    expect(slugify("What 'in-market' actually means")).toBe("what-in-market-actually-means");
    expect(slugify("ICP fit + intent: the two-filter approach")).toBe(
      "icp-fit-intent-the-two-filter-approach",
    );
  });

  it("drops apostrophes instead of splitting on them", () => {
    expect(slugify("Why teams outgrow volume-first tools’ limits")).toBe(
      "why-teams-outgrow-volume-first-tools-limits",
    );
  });

  it("never returns an empty id", () => {
    expect(slugify("???")).toBe("section");
  });
});

describe("outlineArticle", () => {
  const blocks: Block[] = [
    { t: "p", text: "Intro." },
    { t: "h2", text: "Signals" },
    { t: "h3", text: "On LinkedIn" },
    { t: "p", text: "Body." },
    { t: "h2", text: "Signals" },
  ];

  it("gives every heading a unique id, in block order", () => {
    const { ids } = outlineArticle(blocks);
    expect(ids).toEqual([undefined, "signals", "on-linkedin", undefined, "signals-2"]);
  });

  it("lists only the h2 headings in the table of contents", () => {
    const { toc } = outlineArticle(blocks);
    expect(toc).toEqual([
      { id: "signals", text: "Signals" },
      { id: "signals-2", text: "Signals" },
    ]);
  });

  it("puts Key takeaways first when the post has them, and keeps its id free", () => {
    const { ids, toc } = outlineArticle([{ t: "h2", text: "Key takeaways" }], { takeaways: true });
    expect(toc[0]).toEqual({ id: TAKEAWAYS_ID, text: "Key takeaways" });
    expect(ids[0]).toBe(`${TAKEAWAYS_ID}-2`);
  });
});

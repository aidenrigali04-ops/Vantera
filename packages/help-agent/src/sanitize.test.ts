import { describe, expect, it } from "vitest";
import { sanitizeKnowledge } from "./knowledge";

describe("sanitizeKnowledge", () => {
  it("redacts vendor/internal names from chunk content", () => {
    const out = sanitizeKnowledge([{ slug: "x", heading: null, content: "We use Smartlead and Unipile.", similarity: 1 }]);
    const content = out[0]!.content;
    expect(content).not.toMatch(/smartlead|unipile/i);
    expect(content).toContain("our platform");
  });
  it("leaves clean content untouched", () => {
    const out = sanitizeKnowledge([{ slug: "x", heading: null, content: "Clean drafts send automatically.", similarity: 1 }]);
    expect(out[0]!.content).toBe("Clean drafts send automatically.");
  });
});

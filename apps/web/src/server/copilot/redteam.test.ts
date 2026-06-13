import { describe, expect, it } from "vitest";
import { SYSTEM_PROMPT, sanitizeKnowledge } from "@vantera/help-agent";

const banned = /smartlead|unipile|explorium|voyage|anthropic|claude|supabase|higgsfield|clay/i;

describe("copilot restriction posture (red-team)", () => {
  it("system prompt carries the refusal lane", () => {
    expect(SYSTEM_PROMPT).toMatch(/only help with using Vantera/i);
    expect(SYSTEM_PROMPT).toMatch(/do not know how Vantera is built/i);
  });
  it("sanitizer redacts a vendor name that slips into a retrieved chunk", () => {
    const out = sanitizeKnowledge([{ slug: "x", heading: null, content: "We send via Smartlead and connect LinkedIn via Unipile.", similarity: 1 }]);
    expect(out[0].content).not.toMatch(banned);
  });
});

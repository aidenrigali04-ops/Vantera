import { describe, expect, it, vi } from "vitest";
import { generateAdConcepts, adContextBlock, type AdConceptInput } from "./generate";

const input: AdConceptInput = {
  accountName: "Vantera",
  accountIndustry: "B2B SaaS",
  valueProp: "an AI SDR that only works leads worth a rep's time",
  offer: "a free pipeline teardown",
  targetIcp: "VP Sales at 50–500-person SaaS companies",
  cta: "book a 15-minute teardown",
};

// generate is injected, so the model is never used — a stub avoids constructing a real client.
const stubModel = {} as never;

function fakeGenerate(concepts: unknown) {
  return vi.fn(async () => ({ object: { concepts } })) as never;
}

describe("adContextBlock", () => {
  it("includes the seller, offer, target, and CTA as grounding", () => {
    const block = adContextBlock(input);
    expect(block).toContain("Vantera");
    expect(block).toContain("free pipeline teardown");
    expect(block).toContain("VP Sales");
    expect(block).toContain("book a 15-minute teardown");
  });
});

describe("generateAdConcepts", () => {
  it("returns the model's concepts with no violations when copy is grounded", async () => {
    const generate = fakeGenerate([
      { headline: "Stop chasing dead leads", primaryText: "Your reps only call the ones worth it.", cta: "SIGN_UP", creativePrompt: "a focused sales rep" },
    ]);
    const res = await generateAdConcepts(input, stubModel, generate);
    expect(res.concepts).toHaveLength(1);
    expect(res.violations).toEqual([]);
  });

  it("flags a fabricated metric absent from the grounding (anti-hallucination, report #6)", async () => {
    const generate = fakeGenerate([
      { headline: "Book 3x more meetings", primaryText: "Teams see 47% more replies in 30 days.", cta: "LEARN_MORE", creativePrompt: "chart going up" },
    ]);
    const res = await generateAdConcepts(input, stubModel, generate);
    expect(res.violations.length).toBeGreaterThan(0);
  });

  it("requests the asked-for number of variants", async () => {
    const generate = fakeGenerate([]);
    await generateAdConcepts({ ...input, variants: 4 }, stubModel, generate);
    const prompt = (generate as unknown as { mock: { calls: { 0: { prompt: string } }[] } }).mock.calls[0][0].prompt;
    expect(prompt).toContain("4");
  });
});

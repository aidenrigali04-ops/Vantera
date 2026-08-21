import { describe, expect, it } from "vitest";
import { validateRecipeAngle } from "./angle";

describe("validateRecipeAngle", () => {
  it("accepts a short, claim-free style angle", () => {
    expect(validateRecipeAngle("a peer in their niche just solved this same pain")).toBeNull();
    expect(validateRecipeAngle("their recent post topic as the doorway")).toBeNull();
  });

  it("rejects digits, %, $ (no smuggled stats)", () => {
    expect(validateRecipeAngle("teams see 40% more replies")).toMatch(/number|claim/i);
    expect(validateRecipeAngle("save $500 a month")).toMatch(/number|claim/i);
  });

  it("rejects guarantee/promise language", () => {
    expect(validateRecipeAngle("guaranteed meetings from the first note")).toMatch(/claim/i);
    expect(validateRecipeAngle("we promise real pipeline this quarter")).toMatch(/claim/i);
  });

  it("rejects too-short and too-long angles", () => {
    expect(validateRecipeAngle("hi")).toMatch(/length/i);
    expect(validateRecipeAngle("x".repeat(90))).toMatch(/length/i);
  });
});

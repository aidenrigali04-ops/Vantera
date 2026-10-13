import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const HAIKU = [
  "prospect/rank.ts",
  "intent/classify.ts",
  "reply/classify.ts",
  "prospect/website-scan.ts",
  "prospect/icp-draft.ts",
  "prospect/derive-criteria.ts",
  "intent/watchlist.ts",
  "optimize/generate.ts",
];
const SONNET = ["copy/linkedin.ts", "reply/respond.ts", "copy/fix.ts"];

function src(rel: string): string {
  return readFileSync(new URL(`./${rel}`, import.meta.url), "utf8");
}

describe("model split", () => {
  it.each(HAIKU)("%s classifies on the Haiku pin", (rel) => {
    const text = src(rel);
    expect(text).toContain("getClassifierModel");
    expect(text).not.toMatch(/=\s*getModel\(\)/);
    expect(text).not.toMatch(/\?\?\s*getModel\(\)/);
  });

  it.each(SONNET)("%s drafts on the default model", (rel) => {
    const text = src(rel);
    expect(text).toMatch(/getModel\(\)/);
    expect(text).not.toContain("getClassifierModel");
  });

  it("keeps the judge on Opus", () => {
    expect(src("copy/judge.ts")).toContain('JUDGE_MODEL_ID = "claude-opus-4-8"');
  });
});

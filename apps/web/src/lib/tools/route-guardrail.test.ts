import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

/**
 * The public LinkedIn tools run on the Vercel web app, unauthenticated. They must not
 * share the product brains' Anthropic console credits (`getModel()`), or a depleted
 * Anthropic balance takes down the landing-page generators.
 */
const routePath = join(
  dirname(fileURLToPath(import.meta.url)),
  "../../app/api/tools/[slug]/route.ts",
);

describe("public tools route model wiring", () => {
  const src = readFileSync(routePath, "utf8");

  it("loads the model through getPublicModel (AI Gateway), not getModel (Anthropic console)", () => {
    expect(src).toContain("getPublicModel");
    expect(src).not.toMatch(/\bgetModel\s*\(/);
    expect(src).not.toMatch(/api\.anthropic\.com|ANTHROPIC_API_KEY/);
  });
});

import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { loadProof } from "./load";

describe("proof own-rows guardrail (rule 02)", () => {
  it("loadProof takes only the session client — never an account id", () => {
    expect(loadProof.length).toBe(1);
  });

  it.each(["load.ts", "build.ts", "sources.ts"])("%s never names an account id (RLS scopes)", (f) => {
    const src = readFileSync(join(__dirname, f), "utf8");
    expect(src).not.toMatch(/account_?id/i);
  });
});

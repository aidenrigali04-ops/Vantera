import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

/** Every *_SYSTEM prompt must be registered (WS-2.1) — a raw string constant is an
 *  unattributable prompt revision. help-agent's SYSTEM_PROMPT is covered by convention
 *  (packages/help-agent/src/prompt.ts registers it too) — this guardrail only scans
 *  packages/agent-brains/src per the task brief. */
function walk(dir: string): string[] {
  return readdirSync(dir).flatMap((f) => {
    const p = join(dir, f);
    if (statSync(p).isDirectory()) return walk(p);
    return p.endsWith(".ts") && !p.endsWith(".test.ts") ? [p] : [];
  });
}

describe("prompt registry enforcement", () => {
  it("no raw *_SYSTEM string constants — use registerPrompt", () => {
    const offenders = walk(join(__dirname)).filter((p) =>
      /_SYSTEM\s*=\s*[`"']/.test(readFileSync(p, "utf8"))
    );
    expect(offenders, `raw prompt constants in: ${offenders.join(", ")}`).toEqual([]);
  });
});

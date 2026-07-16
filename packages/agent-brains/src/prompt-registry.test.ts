import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

/** Every SYSTEM/PROMPT-named prompt constant must be registered (WS-2.1) — a raw string constant
 *  is an unattributable prompt revision. help-agent's SYSTEM_PROMPT is covered by convention
 *  (packages/help-agent/src/prompt.ts registers it too) — this guardrail only scans
 *  packages/agent-brains/src per the task brief. */
function walk(dir: string): string[] {
  return readdirSync(dir).flatMap((f) => {
    const p = join(dir, f);
    if (statSync(p).isDirectory()) return walk(p);
    return p.endsWith(".ts") && !p.endsWith(".test.ts") ? [p] : [];
  });
}

// Broadened (review-round fix): the old /_SYSTEM\s*=\s*[`"']/ only caught constants ending in
// "_SYSTEM" — a bare `SYSTEM` or any `*PROMPT*`-named constant (e.g. `DRAFT_PROMPT`, `PROMPT`)
// slipped past it as an unregistered, unattributable prompt revision. This catches any ALL-CAPS
// constant whose name contains SYSTEM or PROMPT anywhere, assigned a raw string/template literal.
// Fragments like VOICE_RULES / PROSPECT_ACCURACY_RULE stay allowed raw — neither name contains
// the substring "SYSTEM" or "PROMPT" (PROSPECT ≠ PROMPT), so they never match.
const RAW_PROMPT_CONSTANT = /\b[A-Z0-9_]*(?:SYSTEM|PROMPT)[A-Z0-9_]*\s*=\s*[`"']/;

describe("prompt registry enforcement", () => {
  it("no raw *_SYSTEM string constants — use registerPrompt", () => {
    const offenders = walk(join(__dirname)).filter((p) =>
      RAW_PROMPT_CONSTANT.test(readFileSync(p, "utf8"))
    );
    expect(offenders, `raw prompt constants in: ${offenders.join(", ")}`).toEqual([]);
  });
});

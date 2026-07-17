import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * Prompt-registry call-site enforcement (WS-2.1, task 2). Phase 1 shipped the raw-constant
 * scanner (prompt-registry.test.ts — no bare `*_SYSTEM = "..."`). That alone doesn't stop a call
 * site from bypassing the registry with an inline string: `generateObject({ system: "..." })`
 * would slip right past it. This guardrail closes that gap: every `generateObject`/`generateText`
 * call must source `system:` from a registered handle's `.text` (e.g. `LINKEDIN_SYSTEM.text`),
 * never a string/template literal — so a prompt sent to the model is always attributable back to
 * a registry hash.
 */

/** Mirrors the walk in prompt-registry.test.ts. */
function walk(dir: string): string[] {
  return readdirSync(dir).flatMap((f) => {
    const p = join(dir, f);
    if (statSync(p).isDirectory()) return walk(p);
    return p.endsWith(".ts") && !p.endsWith(".test.ts") ? [p] : [];
  });
}

// Two forms of the same pattern on purpose: a global-flagged regex's `lastIndex` persists
// across `.test()`/`.exec()` calls on the SAME regex object, so reusing one instance for `.test()`
// checks against a SEQUENCE of different file strings (e.g. inside `files.filter(...)`) silently
// skips matches once `lastIndex` drifts past 0. `.match()` with the global flag is safe (it
// resets internally and returns every match), so that form is only for counting. Boolean
// membership checks always use the non-global form.
const GENERATOR_CALL_G = /\b(?:generateObject|generateText)\s*\(/g;
const GENERATOR_CALL = /\b(?:generateObject|generateText)\s*\(/;
const IMPORTS_GENERATOR = /import\s*\{[^}]*\b(?:generateObject|generateText)\b[^}]*\}\s*from\s*["']ai["']/;

/** A registered handle's `.text`, e.g. `RANK_SYSTEM.text` or `LINKEDIN_SYSTEM.text`. */
const REGISTRY_SYSTEM_REF = /\bsystem:\s*[A-Z][A-Z0-9_]*\.text\b/;

/**
 * Pure predicate — the core invariant. True iff `source` passes a `system:` prop that starts with
 * a quote or backtick, i.e. a raw string/template literal instead of a registered `.text` handle.
 * Kept AST-free (regex-scan) to match the `structure.test.ts`/`prompt-registry.test.ts` genre:
 * no parser dependency, cheap, and precise enough for this shape of violation.
 */
export function hasInlineSystem(sourceText: string): boolean {
  // `\b` on the left so `subsystem:`/`filesystem:` (and other `*system:` substrings) don't
  // false-trip the guardrail — mirrors REGISTRY_SYSTEM_REF's `\bsystem:`.
  return /\bsystem:\s*[`"']/.test(sourceText);
}

describe("hasInlineSystem predicate (synthetic evidence the scanner actually detects violations)", () => {
  it("flags a synthetic inline-string system prop", () => {
    const bad = `const x = generateObject({ model, schema, system: "inline prompt, not registered", prompt });`;
    expect(hasInlineSystem(bad)).toBe(true);
  });

  it("flags a synthetic inline template-literal system prop", () => {
    const bad = `await generateText({ model, system: \`inline \${template} prompt\`, prompt });`;
    expect(hasInlineSystem(bad)).toBe(true);
  });

  it("does not flag a registered-handle system prop", () => {
    const good = `const x = generateObject({ model, schema, system: RANK_SYSTEM.text, prompt, maxOutputTokens });`;
    expect(hasInlineSystem(good)).toBe(false);
  });

  it("does not flag files with no system prop at all", () => {
    const good = `const y = someOtherFunctionCall({ model, prompt });`;
    expect(hasInlineSystem(good)).toBe(false);
  });

  it("does not flag a *system: substring like subsystem: (left word boundary)", () => {
    const good = `const cfg = { subsystem: "x", filesystem: "y" };`;
    expect(hasInlineSystem(good)).toBe(false);
  });
});

describe("prompt call-site enforcement (WS-2.1)", () => {
  const files = walk(join(__dirname));
  const sources = new Map(files.map((p) => [p, readFileSync(p, "utf8")]));

  it("sanity: the scan found real generateObject/generateText call sites (proves it isn't scanning zero files)", () => {
    const totalCallSites = [...sources.values()].reduce(
      (n, src) => n + (src.match(GENERATOR_CALL_G)?.length ?? 0),
      0
    );
    expect(totalCallSites).toBeGreaterThanOrEqual(8);
  });

  it("no inline system: string/template literal in any file that calls generateObject/generateText", () => {
    const offenders = files.filter((p) => {
      const src = sources.get(p)!;
      return GENERATOR_CALL.test(src) && hasInlineSystem(src);
    });
    expect(
      offenders,
      `inline (unregistered) system: prompt found in: ${offenders.join(", ")} — ` +
        `use a registered handle's .text (e.g. \`system: LINKEDIN_SYSTEM.text\`) instead of a raw string`
    ).toEqual([]);
  });

  it("every file that imports generateObject/generateText from \"ai\" sources system: from a registered handle's .text", () => {
    const offenders = files.filter((p) => {
      const src = sources.get(p)!;
      if (!IMPORTS_GENERATOR.test(src)) return false;
      // Files that import the generator functions and actually call one of them must reference a
      // registered handle's .text somewhere as their system prompt.
      return GENERATOR_CALL.test(src) && !REGISTRY_SYSTEM_REF.test(src);
    });
    expect(
      offenders,
      `file imports generateObject/generateText but its system: prompt isn't sourced from a ` +
        `registered handle's .text: ${offenders.join(", ")}`
    ).toEqual([]);
  });
});

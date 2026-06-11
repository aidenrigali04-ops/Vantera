import { readdirSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

// Guardrail for rule 13: trigger task files are thin wrappers — the logic lives
// in a pure core under src/pipeline/ so tests never need the Trigger runtime.

const srcDir = dirname(fileURLToPath(import.meta.url));
const triggerDir = join(srcDir, "trigger");

// healthcheck is the deploy smoke test; process-account-deletion predates rule 13
// (Phase 2 GDPR job) — grandfathered, refactor to a pipeline core when next touched
const EXEMPT = new Set(["healthcheck.ts", "process-account-deletion.ts"]);

const taskFiles = readdirSync(triggerDir).filter(
  (f) => f.endsWith(".ts") && !f.endsWith(".test.ts") && !EXEMPT.has(f)
);

describe("trigger tasks are thin wrappers (rule 13, locked)", () => {
  it.each(taskFiles)("%s wires a core from ../pipeline/", (file) => {
    const content = readFileSync(join(triggerDir, file), "utf8");
    expect(content).toMatch(/from\s+["']\.\.\/pipeline\//);
  });

  it.each(taskFiles)("%s stays small (logic belongs in src/pipeline)", (file) => {
    const lines = readFileSync(join(triggerDir, file), "utf8").split("\n").length;
    expect(lines, `${file}: move logic into a pipeline core`).toBeLessThan(80);
  });
});

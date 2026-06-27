import { readdirSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

// Guardrail for rule 13: trigger task files are thin wrappers — the logic lives
// in a pure core under src/pipeline/ so tests never need the Trigger runtime.

const srcDir = dirname(fileURLToPath(import.meta.url));
const triggerDir = join(srcDir, "trigger");

// healthcheck is the deploy smoke test (no pipeline core).
const EXEMPT = new Set(["healthcheck.ts"]);

const allTaskFiles = readdirSync(triggerDir).filter(
  (f) => f.endsWith(".ts") && !f.endsWith(".test.ts")
);
const taskFiles = allTaskFiles.filter((f) => !EXEMPT.has(f));

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

// @supabase/supabase-js eagerly builds a RealtimeClient that needs a native WebSocket; the
// Trigger.dev Node-21 runtime has none, so the client throws at construction (it silently
// broke the GDPR deletion cron for days). Trigger tasks must use the shared Drizzle/postgres-js
// client (createDb) for DB access — never supabase-js.
describe("trigger tasks avoid the supabase-js Node-21 WebSocket footgun", () => {
  it.each(allTaskFiles)("%s does not import @supabase/supabase-js", (file) => {
    const content = readFileSync(join(triggerDir, file), "utf8");
    // Match a real import (from "@supabase/supabase-js"), not a prose mention in a comment.
    expect(content).not.toMatch(/from\s+["']@supabase\/supabase-js["']/);
  });
});

import { readdirSync, readFileSync } from "node:fs";
import { dirname, join, relative } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

// Guardrail for rule 13: brains are pure prompt/logic modules. Orchestration
// (Trigger.dev) and persistence (drizzle/@vantera/db) live in packages/jobs —
// keeping brains importable from anywhere and testable with a mock model only.

const srcDir = dirname(fileURLToPath(import.meta.url));

const files = readdirSync(srcDir, { recursive: true, withFileTypes: true })
  .filter((e) => e.isFile() && e.name.endsWith(".ts"))
  .map((e) => join(e.parentPath, e.name));

const banned = /from\s+["'](@trigger\.dev\/|drizzle-orm|@vantera\/db|postgres|@supabase\/)/;

describe("agent-brains purity (rule 13, locked)", () => {
  it("imports no orchestration or persistence layers", () => {
    const offenders = files
      .filter((f) => banned.test(readFileSync(f, "utf8")))
      .map((f) => relative(srcDir, f));
    expect(offenders).toEqual([]);
  });
});

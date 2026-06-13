import { readdirSync, readFileSync } from "node:fs";
import { dirname, join, relative } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

// Guardrail for rule 09/13: help-agent is a pure agent-core package — no infra
// imports (Next.js, Trigger.dev, drizzle, postgres, pgvector). It must be
// importable from anywhere and testable with injected fakes only.

const srcDir = dirname(fileURLToPath(import.meta.url));

const files = readdirSync(srcDir, { recursive: true, withFileTypes: true })
  .filter((e) => e.isFile() && e.name.endsWith(".ts"))
  .map((e) => join(e.parentPath, e.name));

const banned = /from\s+["'](next|@trigger\.dev\/|drizzle-orm|postgres|pgvector)/;

describe("help-agent purity (rule 09/13, locked)", () => {
  it("imports no Next.js, orchestration, persistence, or vector layers", () => {
    const offenders = files
      .filter((f) => banned.test(readFileSync(f, "utf8")))
      .map((f) => relative(srcDir, f));
    expect(offenders).toEqual([]);
  });
});

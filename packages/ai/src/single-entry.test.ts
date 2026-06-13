import { readdirSync, readFileSync } from "node:fs";
import { dirname, join, relative } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

// Guardrail for rule 02 / rule 13: @vantera/ai is the ONLY package that touches an
// AI provider SDK. Every other workspace gets models via getModel() so providers,
// keys, and model pins stay swappable in one file.

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), "../../..");

function sourceFiles(dir: string): string[] {
  return readdirSync(dir, { recursive: true, withFileTypes: true })
    .filter((e) => e.isFile() && /\.(ts|tsx)$/.test(e.name))
    .map((e) => join(e.parentPath, e.name));
}

function workspaceSrcDirs(): { name: string; src: string }[] {
  const dirs: { name: string; src: string }[] = [];
  for (const group of ["apps", "packages"]) {
    for (const entry of readdirSync(join(repoRoot, group), { withFileTypes: true })) {
      if (!entry.isDirectory()) continue;
      const name = `${group}/${entry.name}`;
      if (name === "packages/ai") continue; // the sanctioned entry point
      try {
        dirs.push({ name, src: join(repoRoot, group, entry.name, "src") });
        readdirSync(join(repoRoot, group, entry.name, "src"));
      } catch {
        dirs.pop(); // no src dir
      }
    }
  }
  return dirs;
}

describe("single AI entry point (rule 02, locked)", () => {
  it.each(workspaceSrcDirs())("$name never imports an AI provider SDK directly", ({ src }) => {
    const offenders: string[] = [];
    for (const file of sourceFiles(src)) {
      const content = readFileSync(file, "utf8");
      if (/from\s+["']@ai-sdk\/|require\(["']@ai-sdk\/|from\s+["']@anthropic-ai\/|voyageai\.com|voyage-ai-provider/.test(content)) {
        offenders.push(relative(repoRoot, file));
      }
    }
    expect(offenders, `import models via @vantera/ai getModel() instead`).toEqual([]);
  });
});

import { readdirSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

export type HelpArticle = {
  slug: string;
  title: string;
  surface: string;
  routes: string[];
  body: string;
};

const CONTENT_DIR = join(dirname(fileURLToPath(import.meta.url)), "..", "content");

export function parseFrontmatter(raw: string): Omit<HelpArticle, "slug"> {
  const match = raw.match(/^---\n([\s\S]*?)\n---\n?([\s\S]*)$/);
  const frontmatter = match?.[1];
  const body = match?.[2];
  if (frontmatter === undefined || body === undefined) {
    throw new Error("missing frontmatter block");
  }
  const fields = new Map<string, string>();
  for (const line of frontmatter.split("\n")) {
    const idx = line.indexOf(":");
    if (idx > 0) fields.set(line.slice(0, idx).trim(), line.slice(idx + 1).trim());
  }
  const title = fields.get("title");
  const surface = fields.get("surface");
  const routes = fields
    .get("routes")
    ?.split(",")
    .map((r) => r.trim())
    .filter(Boolean);
  if (!title || !surface || !routes?.length) {
    throw new Error("frontmatter requires title, surface, and routes");
  }
  return { title, surface, routes, body: body.trim() };
}

export function loadArticles(): HelpArticle[] {
  return readdirSync(CONTENT_DIR)
    .filter((f) => f.endsWith(".md"))
    .map((file) => ({
      slug: file.replace(/\.md$/, ""),
      ...parseFrontmatter(readFileSync(join(CONTENT_DIR, file), "utf8")),
    }));
}

export function articlesForRoute(route: string): HelpArticle[] {
  return loadArticles().filter((a) => a.routes.includes(route));
}

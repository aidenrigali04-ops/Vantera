import { describe, expect, it } from "vitest";
import { articlesForRoute, loadArticles, parseFrontmatter } from "./index";

describe("parseFrontmatter", () => {
  it("parses title, surface, and routes", () => {
    const raw = `---\ntitle: Test\nsurface: dashboard\nroutes: /dashboard, /settings\n---\n\nBody here.`;
    expect(parseFrontmatter(raw)).toEqual({
      title: "Test",
      surface: "dashboard",
      routes: ["/dashboard", "/settings"],
      body: "Body here.",
    });
  });

  it("throws on missing required fields", () => {
    expect(() => parseFrontmatter(`---\ntitle: X\n---\nbody`)).toThrow();
  });
});

describe("loadArticles", () => {
  it("loads every shipped article with complete frontmatter", () => {
    const articles = loadArticles();
    expect(articles.length).toBeGreaterThanOrEqual(4);
    for (const a of articles) {
      expect(a.title).toBeTruthy();
      expect(a.surface).toBeTruthy();
      expect(a.routes.length).toBeGreaterThan(0);
      expect(a.body).toBeTruthy();
    }
  });

  it("never leaks vendor names (white-label, rule 09)", () => {
    const banned =
      /smartlead|smartsenders|unipile|explorium|agentsource|trigger\.dev|supabase|anthropic|claude|higgsfield/i;
    for (const a of loadArticles()) {
      expect(a.title + a.body).not.toMatch(banned);
    }
  });
});

describe("articlesForRoute", () => {
  it("returns articles registered for a route", () => {
    const titles = articlesForRoute("/settings").map((a) => a.title);
    expect(titles.length).toBeGreaterThan(0);
  });
});

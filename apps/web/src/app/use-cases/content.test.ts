import { describe, expect, it } from "vitest";
import { PLAN_DISPLAY, PLAN_DISPLAY_ORDER } from "@vantera/billing";
import { AGENCIES_CONTENT } from "./for-agencies/content";
import { FOUNDERS_CONTENT } from "./for-founders/content";
import { RECRUITERS_CONTENT } from "./for-recruiters/content";
import { SALES_TEAMS_CONTENT } from "./for-sales-teams/content";

const PAGES = [SALES_TEAMS_CONTENT, FOUNDERS_CONTENT, AGENCIES_CONTENT, RECRUITERS_CONTENT];

const allCopy = PAGES.map((c) => JSON.stringify(c)).join(" ");
/* Everything a page asserts: all copy except FAQ questions, which may ask about
   approval in order to answer it. */
const claims = PAGES.map((c) =>
  JSON.stringify({ ...c, faq: { ...c.faq, items: c.faq.items.map((i) => i.a) } }),
).join(" ");

describe("use-case pages", () => {
  it("speak autopilot, never per-message approval", () => {
    expect(claims).not.toMatch(
      /you approve|approve (each|every) (send|message)|review queue|human-in-the-loop|nothing sends (until|without|unseen)/i,
    );
  });

  it("quote the plan on sale, never a retired tier", () => {
    expect(allCopy).not.toMatch(/\bStarter\b|\$45\b/);
    for (const tier of PLAN_DISPLAY_ORDER) expect(allCopy).toContain(PLAN_DISPLAY[tier].name);
  });

  it("never say the trial skips the card (billing collects one up front)", () => {
    expect(allCopy).not.toMatch(/no credit card|no card/i);
  });

  it("names only CRMs Vantera connects to (packages/crm-infra rejects Pipedrive)", () => {
    expect(allCopy).not.toMatch(/pipedrive/i);
  });

  it("never names a white-labeled vendor", () => {
    expect(allCopy).not.toMatch(/unipile|smartlead|explorium|\bclay\b/i);
  });

  it("closes every pipeline rail on the Learn node pipeline-viz accents", () => {
    for (const c of PAGES) expect(c.pipeline.nodes.at(-1)?.label, c.slug).toBe("Learn");
  });
});

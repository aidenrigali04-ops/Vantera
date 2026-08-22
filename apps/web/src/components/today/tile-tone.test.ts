import { describe, expect, it } from "vitest";

import type { TileTone } from "@/lib/today/tiles";

import { TONE_CLASSES, toneClasses } from "./tile-tone";

describe("toneClasses", () => {
  it.each<[TileTone, string, string]>([
    ["routine", "bg-[var(--surface-2)]", "text-[var(--ink)]"],
    ["replies", "bg-[var(--acc-tint)]", "text-[var(--acc-ink)]"],
    ["attention", "bg-[var(--attention-tint)]", "text-[var(--attention)]"],
    ["billing", "bg-[var(--danger-tint)]", "text-[var(--danger)]"],
  ])("%s → tint background + matching glyph color", (tone, bg, fg) => {
    const classes = toneClasses(tone).split(" ");
    expect(classes).toContain(bg);
    expect(classes).toContain(fg);
    expect(classes).toHaveLength(2);
  });

  it("covers every tone exactly once", () => {
    expect(Object.keys(TONE_CLASSES).sort()).toEqual(["attention", "billing", "replies", "routine"]);
  });

  it("falls back to routine for an unknown tone", () => {
    expect(toneClasses("mystery" as TileTone)).toBe(TONE_CLASSES.routine);
  });
});

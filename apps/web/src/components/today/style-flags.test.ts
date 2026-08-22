import { describe, expect, it } from "vitest";
import { parseStyleFlags } from "./style-flags";

describe("parseStyleFlags", () => {
  it("maps the linter's rule id to a human label and keeps the detail", () => {
    expect(parseStyleFlags('banned-phrase: remove "circle back"')).toEqual([
      { label: "Salesy phrase", detail: 'remove "circle back"' },
    ]);
  });

  it("splits on ';' only — a detail's commas must not shred it into extra chips", () => {
    expect(parseStyleFlags("hedging: too much hedging (just, maybe); exclamations: 2 exclamation marks; use at most 1")).toEqual([
      { label: "Hedging", detail: "too much hedging (just, maybe)" },
      { label: "Exclamation marks", detail: "2 exclamation marks" },
      { label: "use at most 1", detail: null },
    ]);
  });

  it("falls back to the de-hyphenated rule when it is unknown, and handles a bare flag", () => {
    expect(parseStyleFlags("some-new-rule: detail")).toEqual([{ label: "some new rule", detail: "detail" }]);
    expect(parseStyleFlags("just a note")).toEqual([{ label: "just a note", detail: null }]);
  });

  it("is empty for null or blank", () => {
    expect(parseStyleFlags(null)).toEqual([]);
    expect(parseStyleFlags("  ")).toEqual([]);
  });
});

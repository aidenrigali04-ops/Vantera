import { describe, expect, it } from "vitest";
import { nextHighlight, nextTab, rowCommand } from "./keyboard";

describe("nextHighlight", () => {
  it("starts at the first row on ArrowDown and the last on ArrowUp when nothing is highlighted", () => {
    expect(nextHighlight(null, "ArrowDown", 5)).toBe(0);
    expect(nextHighlight(null, "ArrowUp", 5)).toBe(4);
  });

  it("moves one row and clamps at both ends", () => {
    expect(nextHighlight(1, "ArrowDown", 5)).toBe(2);
    expect(nextHighlight(4, "ArrowDown", 5)).toBe(4);
    expect(nextHighlight(1, "ArrowUp", 5)).toBe(0);
    expect(nextHighlight(0, "ArrowUp", 5)).toBe(0);
  });

  it("jumps with Home/End and clears with Escape", () => {
    expect(nextHighlight(3, "Home", 5)).toBe(0);
    expect(nextHighlight(0, "End", 5)).toBe(4);
    expect(nextHighlight(2, "Escape", 5)).toBeNull();
  });

  it("is null for an empty table whatever the key", () => {
    expect(nextHighlight(null, "ArrowDown", 0)).toBeNull();
    expect(nextHighlight(2, "ArrowUp", 0)).toBeNull();
    expect(nextHighlight(0, "Home", 0)).toBeNull();
  });

  it("keeps (and clamps) the current row on unrelated keys, e.g. after a row was removed", () => {
    expect(nextHighlight(2, "x", 5)).toBe(2);
    expect(nextHighlight(7, "x", 5)).toBe(4);
    expect(nextHighlight(null, "x", 5)).toBeNull();
  });
});

describe("rowCommand", () => {
  it("maps Enter / L / R / A (either case) to the row commands", () => {
    expect(rowCommand("Enter")).toBe("open");
    expect(rowCommand("l")).toBe("later");
    expect(rowCommand("L")).toBe("later");
    expect(rowCommand("r")).toBe("reject");
    expect(rowCommand("R")).toBe("reject");
    expect(rowCommand("a")).toBe("approve-hint");
    expect(rowCommand("A")).toBe("approve-hint");
  });

  it("ignores every other key", () => {
    expect(rowCommand(" ")).toBeNull();
    expect(rowCommand("ArrowDown")).toBeNull();
    expect(rowCommand("Tab")).toBeNull();
  });
});

describe("nextTab", () => {
  it("wraps in both directions", () => {
    expect(nextTab(2, "ArrowRight", 3)).toBe(0);
    expect(nextTab(0, "ArrowLeft", 3)).toBe(2);
    expect(nextTab(0, "ArrowRight", 3)).toBe(1);
  });

  it("jumps with Home/End and ignores other keys", () => {
    expect(nextTab(1, "Home", 3)).toBe(0);
    expect(nextTab(1, "End", 3)).toBe(2);
    expect(nextTab(1, "ArrowDown", 3)).toBeNull();
    expect(nextTab(0, "ArrowRight", 0)).toBeNull();
  });
});

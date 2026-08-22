import { describe, expect, it } from "vitest";
import { initialsFrom } from "./initials";

describe("initialsFrom", () => {
  it("takes the first and last initials of a display name", () => {
    expect(initialsFrom("Ada Lovelace", "x")).toBe("AL");
    expect(initialsFrom("Ada Byron King Lovelace", "x")).toBe("AL");
  });

  it("uses a single initial for a one-word name", () => {
    expect(initialsFrom("Ada", "x")).toBe("A");
  });

  it("falls back to the session initial when there is no display name", () => {
    expect(initialsFrom(null, "a")).toBe("A");
    expect(initialsFrom("", "b")).toBe("B");
    expect(initialsFrom("   ", "c")).toBe("C");
    expect(initialsFrom(undefined, "")).toBe("?");
  });

  it("drops an email domain and splits on dots, underscores, and dashes", () => {
    expect(initialsFrom("ada.lovelace@example.com", "x")).toBe("AL");
    expect(initialsFrom("ada_lovelace", "x")).toBe("AL");
    expect(initialsFrom("mary-anne", "x")).toBe("MA");
  });

  it("always returns uppercase", () => {
    expect(initialsFrom("grace hopper", "x")).toBe("GH");
  });
});

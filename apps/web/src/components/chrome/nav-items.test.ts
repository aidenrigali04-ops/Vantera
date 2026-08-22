import { describe, expect, it } from "vitest";
import { NAV_ITEMS, badgeFor, formatBadge, isActivePath } from "./nav-items";

describe("NAV_ITEMS", () => {
  it("is the five primary destinations in blueprint order", () => {
    expect(NAV_ITEMS.map((i) => i.href)).toEqual(["/today", "/approvals", "/inbox", "/prospects", "/playbook"]);
  });
});

describe("isActivePath", () => {
  it("matches the route itself and nested routes", () => {
    expect(isActivePath("/inbox", "/inbox")).toBe(true);
    expect(isActivePath("/inbox/abc-123", "/inbox")).toBe(true);
  });

  it("never matches a sibling that only shares the prefix", () => {
    expect(isActivePath("/inboxes", "/inbox")).toBe(false);
    expect(isActivePath("/today-ish", "/today")).toBe(false);
  });

  it("is false without a pathname", () => {
    expect(isActivePath(null, "/today")).toBe(false);
    expect(isActivePath(undefined, "/today")).toBe(false);
  });
});

describe("formatBadge", () => {
  it("hides zero, negative, and missing counts", () => {
    expect(formatBadge(0)).toBeNull();
    expect(formatBadge(-3)).toBeNull();
    expect(formatBadge(undefined)).toBeNull();
    expect(formatBadge(null)).toBeNull();
    expect(formatBadge(Number.NaN)).toBeNull();
  });

  it("shows small counts as-is and caps at 99+", () => {
    expect(formatBadge(1)).toBe("1");
    expect(formatBadge(99)).toBe("99");
    expect(formatBadge(100)).toBe("99+");
    expect(formatBadge(1200)).toBe("99+");
  });
});

describe("badgeFor", () => {
  it("only approvals and inbox carry counts", () => {
    const badges = { approvals: 4, inbox: 2 };
    expect(badgeFor(badges, "approvals")).toBe(4);
    expect(badgeFor(badges, "inbox")).toBe(2);
    expect(badgeFor(badges, "today")).toBeUndefined();
    expect(badgeFor(undefined, "inbox")).toBeUndefined();
  });
});

import { describe, expect, it } from "vitest";
import { workspaceIconCandidates, workspaceIconUrl } from "./workspace-icon";

describe("workspaceIconUrl", () => {
  it("prefers the icon the scan actually found", () => {
    expect(workspaceIconUrl("https://acme.com/brand/icon.svg", "https://acme.com")).toBe("https://acme.com/brand/icon.svg");
  });

  it("upgrades a found http icon to https (the CSP allows https images; http is mixed content)", () => {
    expect(workspaceIconUrl("http://acme.com/icon.png", null)).toBe("https://acme.com/icon.png");
  });

  it("falls back to the site's own /favicon.ico — accounts that predate the scan still get a mark", () => {
    expect(workspaceIconUrl(null, "https://tryorin.xyz")).toBe("https://tryorin.xyz/favicon.ico");
    expect(workspaceIconUrl(null, "www.vanterasystem.dev")).toBe("https://www.vanterasystem.dev/favicon.ico");
  });

  it("keeps only the host — a deep link with a query never becomes the icon path", () => {
    expect(workspaceIconUrl(null, "https://www.instagram.com/mac_occasion?igsh=eDkw&utm_source=qr")).toBe(
      "https://www.instagram.com/favicon.ico"
    );
  });

  it("is null when there is nothing to derive from", () => {
    expect(workspaceIconUrl(null, null)).toBeNull();
    expect(workspaceIconUrl("", "  ")).toBeNull();
    expect(workspaceIconUrl(null, "localhost")).toBeNull();
    expect(workspaceIconUrl(null, "javascript:alert(1)")).toBeNull();
  });

  it("offers more than .ico — a modern site often ships only svg/png, and an SPA answers a missing .ico with 200 HTML", () => {
    const c = workspaceIconCandidates(null, "https://tryorin.xyz");
    expect(c[0]).toBe("https://tryorin.xyz/favicon.ico");
    expect(c).toContain("https://tryorin.xyz/favicon.svg");
    expect(c).toContain("https://tryorin.xyz/apple-touch-icon.png");
    expect(c.every((u) => u.startsWith("https://tryorin.xyz/"))).toBe(true);
  });

  it("a scanned icon is authoritative — no guessing behind it", () => {
    expect(workspaceIconCandidates("https://acme.com/brand/icon.svg", "https://acme.com")).toEqual([
      "https://acme.com/brand/icon.svg",
    ]);
  });

  it("has no candidates at all when there is nothing to derive from", () => {
    expect(workspaceIconCandidates(null, null)).toEqual([]);
  });
});

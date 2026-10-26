import { afterEach, describe, expect, it, vi } from "vitest";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";

vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: () => {} }) }));
vi.mock("@/app/(app)/approvals/actions", () => ({ saveDraftEdit: async () => ({}) }));

const { MessageSection, readSections, writeSection } = await import("./sections");

const draft = {
  id: "s1",
  body: "Hi Sam — saw your hiring post.",
  status: "pending_review",
  linkedin_stage: "invite",
  origin: null,
  style_flags: null,
};

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("section store", () => {
  it("falls back to memory when localStorage.setItem throws, so toggles still work", () => {
    vi.stubGlobal("window", {
      localStorage: {
        getItem: () => null,
        setItem: () => {
          throw new Error("blocked");
        },
      },
    });
    writeSection("signals", false);
    expect(readSections().signals).toBe(false);
    writeSection("signals", true);
    expect(readSections().signals).toBe(true);
  });
});

describe("MessageSection", () => {
  it("shows the save error and keeps the editor open with the text", () => {
    const html = renderToStaticMarkup(
      createElement(MessageSection, { draft, initialEditing: true, initialError: "That draft was already handled." })
    );
    expect(html).toContain('role="alert"');
    expect(html).toContain("That draft was already handled.");
    expect(html).toContain("<textarea");
    expect(html).toContain("Hi Sam — saw your hiring post.");
  });

  it("hides Regenerate unless a regenerate action is supplied", () => {
    const without = renderToStaticMarkup(createElement(MessageSection, { draft }));
    expect(without).toContain("Edit");
    expect(without).not.toContain("Regenerate");
    const withIt = renderToStaticMarkup(
      createElement(MessageSection, { draft, onRegenerate: async () => ({}) })
    );
    expect(withIt).toContain("Regenerate");
  });

  it("shows the draft's style flags", () => {
    const html = renderToStaticMarkup(
      createElement(MessageSection, { draft: { ...draft, style_flags: "Sounds templated" } })
    );
    expect(html).toContain("Style check: Sounds templated");
  });
});

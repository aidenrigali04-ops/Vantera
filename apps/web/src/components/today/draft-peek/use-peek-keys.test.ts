import { describe, expect, it, vi } from "vitest";
import { PEEK_KEYS, dispatchPeekKey, resolvePeekKey, type PeekKeyEvent, type PeekKeyHandlers } from "./use-peek-keys";

/** a fake target: tag + the role it sits inside (for `closest`) */
function el(tagName = "DIV", inside: string | null = null, isContentEditable = false) {
  return {
    tagName,
    isContentEditable,
    closest: (sel: string) => (inside && sel.includes(`[role="${inside}"]`) ? {} : null),
  } as unknown as EventTarget;
}

function key(k: string, over: Partial<PeekKeyEvent> = {}): PeekKeyEvent {
  return { key: k, defaultPrevented: false, metaKey: false, ctrlKey: false, altKey: false, preventDefault: vi.fn(), target: el(), ...over };
}

function handlers(escapeHandled = true): PeekKeyHandlers {
  return { approve: vi.fn(), edit: vi.fn(), regenerate: vi.fn(), reject: vi.fn(), next: vi.fn(), prev: vi.fn(), escape: vi.fn(() => escapeHandled) };
}

describe("PEEK_KEYS", () => {
  it("is the A/E/G/R/←/→/Esc table", () => {
    expect(PEEK_KEYS).toEqual({ a: "approve", e: "edit", g: "regenerate", r: "reject", arrowright: "next", arrowleft: "prev", escape: "escape" });
  });
});

describe("resolvePeekKey", () => {
  it.each([
    ["a", "approve"],
    ["A", "approve"],
    ["e", "edit"],
    ["g", "regenerate"],
    ["r", "reject"],
    ["ArrowRight", "next"],
    ["ArrowLeft", "prev"],
    ["Escape", "escape"],
  ])("maps %s to %s", (k, action) => {
    expect(resolvePeekKey(key(k))).toBe(action);
  });

  it("does not handle ? (the global shortcut sheet) or unknown keys", () => {
    expect(resolvePeekKey(key("?"))).toBeNull();
    expect(resolvePeekKey(key("x"))).toBeNull();
  });

  it("ignores letters while typing in a textarea / input / contenteditable, but Esc still works", () => {
    for (const target of [el("TEXTAREA"), el("INPUT"), el("DIV", null, true)]) {
      expect(resolvePeekKey(key("a", { target }))).toBeNull();
      expect(resolvePeekKey(key("ArrowRight", { target }))).toBeNull();
      expect(resolvePeekKey(key("Escape", { target }))).toBe("escape");
    }
  });

  it("leaves selects, tabs and confirmation dialogs their own keys (Esc included)", () => {
    for (const target of [el("SELECT"), el("BUTTON", "tab"), el("BUTTON", "alertdialog")]) {
      expect(resolvePeekKey(key("a", { target }))).toBeNull();
      expect(resolvePeekKey(key("Escape", { target }))).toBeNull();
    }
  });

  it("skips an already-handled event and modifier chords", () => {
    expect(resolvePeekKey(key("a", { defaultPrevented: true }))).toBeNull();
    expect(resolvePeekKey(key("a", { metaKey: true }))).toBeNull();
    expect(resolvePeekKey(key("r", { ctrlKey: true }))).toBeNull();
    expect(resolvePeekKey(key("e", { altKey: true }))).toBeNull();
  });
});

describe("dispatchPeekKey", () => {
  it("runs the mapped handler; letters claim the key, arrows don't", () => {
    const h = handlers();
    const g = key("g");
    expect(dispatchPeekKey(g, h)).toBe("regenerate");
    expect(h.regenerate).toHaveBeenCalledOnce();
    expect(g.preventDefault).toHaveBeenCalled();

    const right = key("ArrowRight");
    dispatchPeekKey(right, h);
    expect(h.next).toHaveBeenCalledOnce();
    expect(right.preventDefault).not.toHaveBeenCalled();
  });

  it("claims Esc only when the cascade handled it", () => {
    const handled = key("Escape");
    const h = handlers(true);
    dispatchPeekKey(handled, h);
    expect(h.escape).toHaveBeenCalledWith(handled.target);
    expect(handled.preventDefault).toHaveBeenCalled();

    const ignored = key("Escape");
    dispatchPeekKey(ignored, handlers(false));
    expect(ignored.preventDefault).not.toHaveBeenCalled();
  });

  it("calls nothing for an ignored key", () => {
    const h = handlers();
    expect(dispatchPeekKey(key("a", { target: el("TEXTAREA") }), h)).toBeNull();
    expect(h.approve).not.toHaveBeenCalled();
  });
});

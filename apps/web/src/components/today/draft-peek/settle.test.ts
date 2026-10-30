import { describe, expect, it, vi } from "vitest";
import { settleRemoval } from "./settle";

function ctx(currentId: string | null) {
  return { currentId, onError: vi.fn(), onRemoved: vi.fn(), announce: vi.fn(), onNavigate: vi.fn(), onClose: vi.fn() };
}

describe("settleRemoval", () => {
  it("collapses the row, toasts, and opens the next draft while the draft is still open", () => {
    const c = ctx("d1");
    expect(settleRemoval("d1", {}, { kind: "open", id: "d2" }, c)).toBe(true);
    expect(c.onRemoved).toHaveBeenCalledOnce();
    expect(c.announce).toHaveBeenCalledOnce();
    expect(c.onNavigate).toHaveBeenCalledWith("d2");
  });

  it("closes when the plan says close", () => {
    const c = ctx("d1");
    settleRemoval("d1", {}, { kind: "close" }, c);
    expect(c.onClose).toHaveBeenCalledOnce();
  });

  it("drops the navigation for a stale id (owner moved on) but still collapses + toasts", () => {
    const c = ctx("d9");
    settleRemoval("d1", {}, { kind: "open", id: "d2" }, c);
    expect(c.onRemoved).toHaveBeenCalledOnce();
    expect(c.announce).toHaveBeenCalledOnce();
    expect(c.onNavigate).not.toHaveBeenCalled();
    expect(c.onClose).not.toHaveBeenCalled();
  });

  it("shows an error only while the draft is open; nothing is removed on error", () => {
    const open = ctx("d1");
    expect(settleRemoval("d1", { error: "nope" }, null, open)).toBe(false);
    expect(open.onError).toHaveBeenCalledWith("nope");
    expect(open.onRemoved).not.toHaveBeenCalled();

    const stale = ctx("d2");
    settleRemoval("d1", { error: "nope" }, null, stale);
    expect(stale.onError).not.toHaveBeenCalled();
    expect(stale.onRemoved).not.toHaveBeenCalled();
  });
});

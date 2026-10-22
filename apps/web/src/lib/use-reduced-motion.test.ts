import { afterEach, describe, expect, it, vi } from "vitest";
import { createElement } from "react";
import { renderToString } from "react-dom/server";
import { getServerSnapshot, getSnapshot, subscribe, useReducedMotion } from "./use-reduced-motion";

/** A window whose reduced-motion query matches, with the listener calls recorded. */
function stubWindow(matches: boolean) {
  const mql = { matches, addEventListener: vi.fn(), removeEventListener: vi.fn() };
  vi.stubGlobal("window", { matchMedia: vi.fn(() => mql) });
  return mql;
}

afterEach(() => vi.unstubAllGlobals());

describe("useReducedMotion", () => {
  it("renders the server snapshot (false) even when the visitor prefers reduced motion", () => {
    // Hydration must reproduce the server HTML, so the first render can't read the query.
    stubWindow(true);
    function Probe() {
      return createElement("span", null, String(useReducedMotion()));
    }
    expect(renderToString(createElement(Probe))).toBe("<span>false</span>");
    expect(getServerSnapshot()).toBe(false);
  });

  it("reads the media query on the client", () => {
    stubWindow(true);
    expect(getSnapshot()).toBe(true);
    stubWindow(false);
    expect(getSnapshot()).toBe(false);
  });

  it("listens for preference changes and stops when unsubscribed", () => {
    const mql = stubWindow(false);
    const onChange = () => {};
    const unsubscribe = subscribe(onChange);
    expect(mql.addEventListener).toHaveBeenCalledWith("change", onChange);
    unsubscribe();
    expect(mql.removeEventListener).toHaveBeenCalledWith("change", onChange);
  });
});

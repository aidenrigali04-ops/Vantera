import { afterEach, describe, expect, it, vi } from "vitest";
import {
  clarityEvent,
  clarityIdentify,
  claritySet,
  clarityUpgrade,
  trackEvent,
} from "./clarity";

type ClarityStub = ((...args: unknown[]) => void) & { q?: unknown[] };

function fakeWindow(overrides: Record<string, unknown> = {}) {
  const win = { ...overrides } as Record<string, unknown> & {
    clarity?: ClarityStub;
    dataLayer?: unknown[];
  };
  vi.stubGlobal("window", win);
  return win;
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("clarity wrapper", () => {
  it("no-ops without throwing when window is undefined (SSR safety)", () => {
    expect(() => {
      clarityIdentify("user-1");
      claritySet("plan", "scale");
      clarityEvent("agent_deployed");
      clarityUpgrade("onboarding");
      trackEvent("onboarding_completed");
    }).not.toThrow();
  });

  it("queues calls before the Clarity tag loads (creates the bootstrap queue stub)", () => {
    const win = fakeWindow();
    clarityIdentify("user-1", "user@example.com");
    claritySet("plan", "growth");
    expect(win.clarity).toBeTypeOf("function");
    expect(win.clarity?.q).toHaveLength(2);
    const first = win.clarity?.q?.[0] as IArguments;
    expect(Array.from(first)).toEqual(["identify", "user-1", undefined, undefined, "user@example.com"]);
    const second = win.clarity?.q?.[1] as IArguments;
    expect(Array.from(second)).toEqual(["set", "plan", "growth"]);
  });

  it("calls straight through when the Clarity tag is already live", () => {
    const clarity = vi.fn() as ClarityStub;
    fakeWindow({ clarity });
    clarityEvent("agent_deployed");
    clarityUpgrade("onboarding");
    expect(clarity).toHaveBeenCalledWith("event", "agent_deployed");
    expect(clarity).toHaveBeenCalledWith("upgrade", "onboarding");
  });

  it("omits identify's friendly name when not provided", () => {
    const clarity = vi.fn() as ClarityStub;
    fakeWindow({ clarity });
    clarityIdentify("user-2");
    expect(clarity).toHaveBeenCalledWith("identify", "user-2", undefined, undefined, undefined);
  });

  it("trackEvent fires Clarity and GA4 together", () => {
    const clarity = vi.fn() as ClarityStub;
    const win = fakeWindow({ clarity });
    trackEvent("onboarding_completed", { surface: "onboarding" });
    expect(clarity).toHaveBeenCalledWith("event", "onboarding_completed");
    expect(win.dataLayer).toHaveLength(1);
    const pushed = win.dataLayer?.[0] as IArguments;
    expect(Array.from(pushed)).toEqual(["event", "onboarding_completed", { surface: "onboarding" }]);
  });
});

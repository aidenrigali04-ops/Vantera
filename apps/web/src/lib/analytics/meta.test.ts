import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { metaFunnelEvent, metaIdentify, metaTrack, metaTrackCustom } from "./meta";

type FbqStub = ((...args: unknown[]) => void) & { queue?: unknown[] };

function fakeWindow(overrides: Record<string, unknown> = {}) {
  const win = { ...overrides } as Record<string, unknown> & {
    fbq?: FbqStub;
    localStorage?: Storage;
  };
  vi.stubGlobal("window", win);
  return win;
}

function fakeStorage(): Storage {
  const store = new Map<string, string>();
  return {
    getItem: (k: string) => store.get(k) ?? null,
    setItem: (k: string, v: string) => void store.set(k, v),
    removeItem: (k: string) => void store.delete(k),
    clear: () => store.clear(),
    key: () => null,
    get length() {
      return store.size;
    },
  } as Storage;
}

beforeEach(() => {
  vi.stubEnv("NEXT_PUBLIC_META_PIXEL_ID", "1234567890");
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});

describe("meta pixel wrapper", () => {
  it("no-ops without throwing when window is undefined (SSR safety)", () => {
    expect(() => {
      metaTrack("PageView");
      metaTrackCustom("agent_deployed");
      metaIdentify("user@example.com");
      metaFunnelEvent("onboarding_completed");
    }).not.toThrow();
  });

  it("no-ops entirely when no pixel id is configured", () => {
    vi.stubEnv("NEXT_PUBLIC_META_PIXEL_ID", "");
    const win = fakeWindow();
    metaTrack("PageView");
    expect(win.fbq).toBeUndefined();
  });

  it("queues calls before fbevents.js loads (creates the official-shape stub)", () => {
    const win = fakeWindow();
    metaTrack("ViewContent", { content_name: "pricing" });
    expect(win.fbq).toBeTypeOf("function");
    expect(win.fbq?.queue).toHaveLength(1);
    const first = win.fbq?.queue?.[0] as IArguments;
    expect(Array.from(first)).toEqual(["track", "ViewContent", { content_name: "pricing" }]);
  });

  it("calls straight through when the pixel is already live", () => {
    const fbq = vi.fn() as FbqStub;
    fakeWindow({ fbq });
    metaTrack("PageView");
    metaIdentify("User@Example.com ");
    expect(fbq).toHaveBeenCalledWith("track", "PageView", {});
    // identify lowercases + trims and re-inits with advanced matching
    expect(fbq).toHaveBeenCalledWith("init", "1234567890", { em: "user@example.com" });
  });

  it("maps funnel names to Meta standard events", () => {
    const fbq = vi.fn() as FbqStub;
    fakeWindow({ fbq });
    metaFunnelEvent("onboarding_completed");
    expect(fbq).toHaveBeenCalledWith("track", "CompleteRegistration", {});
  });

  it("coerces value to a number and defaults currency for purchase-style events", () => {
    const fbq = vi.fn() as FbqStub;
    fakeWindow({ fbq });
    metaFunnelEvent("subscription_started", { plan: "growth", interval: "month", value: "349" });
    expect(fbq).toHaveBeenCalledWith("track", "Subscribe", {
      plan: "growth",
      interval: "month",
      value: 349,
      currency: "USD",
    });
  });

  it("drops a non-numeric value instead of sending garbage", () => {
    const fbq = vi.fn() as FbqStub;
    fakeWindow({ fbq });
    metaFunnelEvent("subscription_started", { value: "not-a-number" });
    expect(fbq).toHaveBeenCalledWith("track", "Subscribe", {});
  });

  it("forwards unmapped funnel names as custom events", () => {
    const fbq = vi.fn() as FbqStub;
    fakeWindow({ fbq });
    metaFunnelEvent("agent_deployed", { kind: "scout" });
    expect(fbq).toHaveBeenCalledWith("trackCustom", "agent_deployed", { kind: "scout" });
  });

  it("fires Lead at most once per browser (localStorage guard)", () => {
    const fbq = vi.fn();
    fakeWindow({ fbq: fbq as FbqStub, localStorage: fakeStorage() });
    metaFunnelEvent("onboarding_started");
    metaFunnelEvent("onboarding_started");
    const leadCalls = fbq.mock.calls.filter((c: unknown[]) => c[1] === "Lead");
    expect(leadCalls).toHaveLength(1);
  });

  it("still fires Lead when storage is unavailable", () => {
    const fbq = vi.fn() as FbqStub;
    const throwingStorage = {
      getItem: () => {
        throw new Error("denied");
      },
    } as unknown as Storage;
    fakeWindow({ fbq, localStorage: throwingStorage });
    metaFunnelEvent("onboarding_started");
    expect(fbq).toHaveBeenCalledWith("track", "Lead", {});
  });
});

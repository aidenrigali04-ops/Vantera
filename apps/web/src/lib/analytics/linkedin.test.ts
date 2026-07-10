import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { linkedinFunnelEvent, linkedinPartnerId } from "./linkedin";

type LintrkStub = ((action: string, data?: Record<string, unknown>) => void) & {
  q?: unknown[][];
};

function fakeWindow(overrides: Record<string, unknown> = {}) {
  const win = { ...overrides } as Record<string, unknown> & { lintrk?: LintrkStub };
  vi.stubGlobal("window", win);
  return win;
}

beforeEach(() => {
  vi.stubEnv("NEXT_PUBLIC_LINKEDIN_PARTNER_ID", "9999999");
  vi.stubEnv("NEXT_PUBLIC_LI_CONV_SIGNUP", "12345");
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});

describe("linkedin insight tag wrapper", () => {
  it("no-ops without throwing when window is undefined (SSR safety)", () => {
    expect(() => linkedinFunnelEvent("onboarding_completed")).not.toThrow();
  });

  it("fires a mapped funnel event as a lintrk conversion with the env id", () => {
    const win = fakeWindow();
    linkedinFunnelEvent("onboarding_completed");
    // queued on the stub as [action, data] since insight.min.js hasn't loaded
    expect(win.lintrk?.q).toEqual([["track", { conversion_id: 12345 }]]);
  });

  it("falls back to the hardcoded signup conversion id when the env override is blank", () => {
    vi.stubEnv("NEXT_PUBLIC_LI_CONV_SIGNUP", ""); // blank env (as in .env.example) = unset
    const win = fakeWindow();
    linkedinFunnelEvent("onboarding_completed");
    expect(win.lintrk?.q).toEqual([["track", { conversion_id: 28665098 }]]);
  });

  it("does not fire for a funnel event with no mapped conversion id", () => {
    const win = fakeWindow();
    linkedinFunnelEvent("checkout_started"); // NEXT_PUBLIC_LI_CONV_CHECKOUT unset
    expect(win.lintrk).toBeUndefined();
  });

  it("uses the hardcoded partner id by default and honors the env override", () => {
    vi.stubEnv("NEXT_PUBLIC_LINKEDIN_PARTNER_ID", ""); // blank env = use the default
    expect(linkedinPartnerId()).toBe("9356898");
    vi.stubEnv("NEXT_PUBLIC_LINKEDIN_PARTNER_ID", "7654321");
    expect(linkedinPartnerId()).toBe("7654321");
  });
});

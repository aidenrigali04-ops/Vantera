import { describe, expect, it } from "vitest";
import { resolveGate, type GateContext } from "./gate";

const ctx = (over: Partial<GateContext>): GateContext => ({
  isAuthenticated: false,
  hasAccount: false,
  onboardingComplete: false,
  ...over,
});

describe("resolveGate", () => {
  it("auth pages redirect signed-in users to the dashboard", () => {
    expect(resolveGate("auth", ctx({ isAuthenticated: true }))).toBe("/dashboard");
  });

  it("auth pages render for anonymous users", () => {
    expect(resolveGate("auth", ctx({}))).toBeNull();
  });

  it("onboarding requires sign-in", () => {
    expect(resolveGate("onboarding", ctx({}))).toBe("/login");
  });

  it("onboarding renders for signed-in users without an account", () => {
    expect(resolveGate("onboarding", ctx({ isAuthenticated: true }))).toBeNull();
  });

  it("onboarding redirects to dashboard once complete", () => {
    expect(
      resolveGate(
        "onboarding",
        ctx({ isAuthenticated: true, hasAccount: true, onboardingComplete: true })
      )
    ).toBe("/dashboard");
  });

  it("app requires sign-in", () => {
    expect(resolveGate("app", ctx({}))).toBe("/login");
  });

  it("app hard-gates incomplete onboarding", () => {
    expect(resolveGate("app", ctx({ isAuthenticated: true }))).toBe("/onboarding");
    expect(resolveGate("app", ctx({ isAuthenticated: true, hasAccount: true }))).toBe(
      "/onboarding"
    );
  });

  it("app renders when the chain is satisfied", () => {
    expect(
      resolveGate("app", ctx({ isAuthenticated: true, hasAccount: true, onboardingComplete: true }))
    ).toBeNull();
  });
});

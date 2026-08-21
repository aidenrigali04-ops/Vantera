import { describe, expect, it } from "vitest";
import { loginRedirect, resolveGate, type GateContext } from "./gate";

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

describe("loginRedirect (deep-link preservation)", () => {
  it("carries the requested path as ?next= so login can forward back", () => {
    // The bug this fixes: a logged-out pull-back-email recipient clicking "Review the
    // messages" (/review) bounced to a bare /login and, after signing in, dead-ended on
    // /dashboard instead of the review queue.
    expect(loginRedirect("/login", "/review")).toBe("/login?next=%2Freview");
    expect(loginRedirect("/login", "/leads")).toBe("/login?next=%2Fleads");
  });

  it("encodes a query string so it survives the outer ?next=", () => {
    expect(loginRedirect("/login", "/leads?view=compact")).toBe(
      "/login?next=%2Fleads%3Fview%3Dcompact"
    );
  });

  it("drops an open-redirect target — never trusts the path blindly", () => {
    expect(loginRedirect("/login", "https://evil.com")).toBe("/login");
    expect(loginRedirect("/login", "//evil.com")).toBe("/login");
    expect(loginRedirect("/login", null)).toBe("/login");
  });

  it("leaves a non-/login destination untouched (onboarding, dashboard)", () => {
    expect(loginRedirect("/onboarding", "/review")).toBe("/onboarding");
    expect(loginRedirect("/dashboard", "/review")).toBe("/dashboard");
  });
});

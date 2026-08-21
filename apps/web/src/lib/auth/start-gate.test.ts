import { describe, expect, it } from "vitest";
import { guessCompanyName, resolveStartGate, resolveStartStep, type StartContext } from "./start-gate";

function ctx(over: Partial<StartContext> = {}): StartContext {
  return {
    isAuthenticated: false,
    hasAccount: false,
    businessConfirmed: false,
    icpConfirmed: false,
    linkedinConnected: false,
    onboardingComplete: false,
    ...over,
  };
}

describe("resolveStartStep — furthest incomplete step", () => {
  it("anonymous → /start", () => {
    expect(resolveStartStep(ctx())).toBe("/start");
  });

  it("authed without an account → /start (claim half-finished)", () => {
    expect(resolveStartStep(ctx({ isAuthenticated: true }))).toBe("/start");
  });

  it("account only → /start/business", () => {
    expect(resolveStartStep(ctx({ isAuthenticated: true, hasAccount: true }))).toBe("/start/business");
  });

  it("business confirmed → /start/buyers", () => {
    expect(
      resolveStartStep(ctx({ isAuthenticated: true, hasAccount: true, businessConfirmed: true }))
    ).toBe("/start/buyers");
  });

  it("ICP confirmed → /start/linkedin", () => {
    expect(
      resolveStartStep(
        ctx({ isAuthenticated: true, hasAccount: true, businessConfirmed: true, icpConfirmed: true })
      )
    ).toBe("/start/linkedin");
  });

  it("linkedin connecting counts as connected → /reveal", () => {
    expect(
      resolveStartStep(
        ctx({
          isAuthenticated: true,
          hasAccount: true,
          businessConfirmed: true,
          icpConfirmed: true,
          linkedinConnected: true,
        })
      )
    ).toBe("/reveal");
  });

  it("onboarding complete → /dashboard from any state (legacy or post-payment users never re-enter)", () => {
    expect(resolveStartStep(ctx({ isAuthenticated: true, onboardingComplete: true }))).toBe("/dashboard");
    expect(
      resolveStartStep(
        ctx({ isAuthenticated: true, hasAccount: true, businessConfirmed: true, onboardingComplete: true })
      )
    ).toBe("/dashboard");
  });
});

describe("resolveStartGate — strict per-page gate", () => {
  it("renders the step the user is due for", () => {
    expect(resolveStartGate("/start", ctx())).toBeNull();
    expect(resolveStartGate("/start/business", ctx({ isAuthenticated: true, hasAccount: true }))).toBeNull();
  });

  it("bounces a later step back to the furthest incomplete", () => {
    expect(resolveStartGate("/reveal", ctx({ isAuthenticated: true, hasAccount: true }))).toBe(
      "/start/business"
    );
  });

  it("bounces an earlier step forward", () => {
    const done = ctx({
      isAuthenticated: true,
      hasAccount: true,
      businessConfirmed: true,
      icpConfirmed: true,
      linkedinConnected: true,
    });
    expect(resolveStartGate("/start/business", done)).toBe("/reveal");
  });
});

describe("guessCompanyName", () => {
  it("uses the domain, title-cased", () => {
    expect(guessCompanyName("jane@acme.io")).toBe("Acme");
    expect(guessCompanyName("j@app.northwind.com")).toBe("Northwind");
  });

  it("handles multi-part TLDs", () => {
    expect(guessCompanyName("j@acme.co.uk")).toBe("Acme");
  });

  it("free-mail falls back to the local part", () => {
    expect(guessCompanyName("jane.doe@gmail.com")).toBe("Jane");
    expect(guessCompanyName("mike@outlook.com")).toBe("Mike");
  });

  it("degrades to a neutral name", () => {
    expect(guessCompanyName("nodomain")).toBe("Your workspace");
  });
});

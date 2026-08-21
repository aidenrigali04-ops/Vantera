import { describe, expect, it } from "vitest";
import { SAFE_PROFILE, deriveAccountProfile, type AccountProfileConfig } from "./profile";

// deriveAccountProfile is PURE and NEVER sees message text (config-aware selection, spec 2026-07-21):
// it reads the seller's configured platform (cta, urls, industry, valueProp, assets, proof) and
// returns an approach prior + eligibility filter. Facts still come from grounding — this touches
// APPROACH knobs only.

describe("deriveAccountProfile — conversionStyle (cta keyword scan, url reinforcement)", () => {
  it("booking: a book/call/demo/meeting cta", () => {
    for (const cta of ["book a 15-min intro", "hop on a call", "see a demo", "grab a meeting"]) {
      expect(deriveAccountProfile({ cta }).conversionStyle, cta).toBe("booking");
    }
  });

  it("self_serve: a try/trial/free/start/sign-up cta", () => {
    for (const cta of ["start a free trial", "try it free", "sign up today", "get started"]) {
      expect(deriveAccountProfile({ cta }).conversionStyle, cta).toBe("self_serve");
    }
  });

  it("traffic: a see/look/portfolio/site cta WITH a website and no booking url", () => {
    expect(
      deriveAccountProfile({ cta: "see the work", hasWebsiteUrl: true }).conversionStyle
    ).toBe("traffic");
    expect(
      deriveAccountProfile({ cta: "check out the portfolio", hasWebsiteUrl: true }).conversionStyle
    ).toBe("traffic");
  });

  it("a traffic-keyword cta with a booking url is NOT traffic — booking url reinforces booking", () => {
    // "see the work" but they also configured a booking link → the booking intent wins.
    expect(
      deriveAccountProfile({ cta: "see the work", hasWebsiteUrl: true, hasBookingUrl: true })
        .conversionStyle
    ).toBe("booking");
  });

  it("booking keyword outranks a self_serve keyword in the same cta (scan order)", () => {
    expect(deriveAccountProfile({ cta: "start a call" }).conversionStyle).toBe("booking");
  });

  it("reinforcement when the cta is ambiguous: booking url → booking, website url → traffic", () => {
    expect(deriveAccountProfile({ cta: "reach out", hasBookingUrl: true }).conversionStyle).toBe(
      "booking"
    );
    expect(deriveAccountProfile({ cta: "reach out", hasWebsiteUrl: true }).conversionStyle).toBe(
      "traffic"
    );
  });

  it("reply: an ambiguous cta with no urls (the safe default)", () => {
    expect(deriveAccountProfile({ cta: "reply to learn more" }).conversionStyle).toBe("reply");
    expect(deriveAccountProfile({ cta: "let me know your thoughts" }).conversionStyle).toBe("reply");
  });

  it("does not false-match keywords inside larger words (word-boundary scan)", () => {
    // "callous" must not read as the "call" booking keyword; "freelance" must not read as "free".
    // (These have no url set, so they can't reach a style via reinforcement either — isolating the
    // keyword scan. Url reinforcement itself is covered by the ambiguous-cta test above.)
    expect(deriveAccountProfile({ cta: "share your callous take" }).conversionStyle).not.toBe(
      "booking"
    );
    expect(deriveAccountProfile({ cta: "freelance with us" }).conversionStyle).not.toBe(
      "self_serve"
    );
  });
});

describe("deriveAccountProfile — trust (regulated/high-trust verticals)", () => {
  it("high: a regulated industry", () => {
    for (const industry of [
      "finance",
      "banking",
      "wealth management",
      "insurance",
      "legal services",
      "law firm",
      "healthcare",
      "medical devices",
      "pharma",
      "government contracting",
    ]) {
      expect(deriveAccountProfile({ industry }).trust, industry).toBe("high");
    }
  });

  it("high: a regulated signal in the valueProp even when industry is generic", () => {
    expect(
      deriveAccountProfile({ industry: "software", valueProp: "compliance tooling for banks" }).trust
    ).toBe("high");
  });

  it("standard: a non-regulated industry", () => {
    for (const industry of ["saas", "devtools", "marketing agency", "ecommerce", "logistics"]) {
      expect(deriveAccountProfile({ industry }).trust, industry).toBe("standard");
    }
  });

  it("does not false-match regulated words inside larger words", () => {
    // "flawless"/"lawn" must not trip "law"; "banking" is real but "embankment" is not.
    expect(deriveAccountProfile({ industry: "flawless lawn care" }).trust).toBe("standard");
  });
});

describe("deriveAccountProfile — hasArtifact + proofDepth", () => {
  it("hasArtifact reflects the account having content to give", () => {
    expect(deriveAccountProfile({ hasArtifact: true }).hasArtifact).toBe(true);
    expect(deriveAccountProfile({ hasArtifact: false }).hasArtifact).toBe(false);
    expect(deriveAccountProfile({}).hasArtifact).toBe(false);
  });

  it("proofDepth: 0 none / 1 some / >=2 rich", () => {
    expect(deriveAccountProfile({ proofCount: 0 }).proofDepth).toBe("none");
    expect(deriveAccountProfile({ proofCount: 1 }).proofDepth).toBe("some");
    expect(deriveAccountProfile({ proofCount: 2 }).proofDepth).toBe("rich");
    expect(deriveAccountProfile({ proofCount: 9 }).proofDepth).toBe("rich");
  });
});

describe("deriveAccountProfile — safe degradation", () => {
  it("absent/empty config degrades to the safe profile (identical to today's behavior)", () => {
    const safe: ReturnType<typeof deriveAccountProfile> = {
      conversionStyle: "reply",
      trust: "standard",
      hasArtifact: false,
      proofDepth: "none",
    };
    expect(deriveAccountProfile({})).toEqual(safe);
    expect(deriveAccountProfile({} as AccountProfileConfig)).toEqual(SAFE_PROFILE);
    // undefined-ish fields are tolerated
    expect(
      deriveAccountProfile({ cta: undefined, industry: null, valueProp: null })
    ).toEqual(safe);
  });

  it("SAFE_PROFILE is the documented safe degrade target", () => {
    expect(SAFE_PROFILE).toEqual({
      conversionStyle: "reply",
      trust: "standard",
      hasArtifact: false,
      proofDepth: "none",
    });
  });
});

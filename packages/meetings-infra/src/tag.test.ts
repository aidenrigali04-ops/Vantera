import { describe, expect, it } from "vitest";
import { leadTag, parseLeadTag } from "./tag";

const ID = "3f6c2a9e-1b2d-4c3e-9f00-1234567890ab";

describe("lead tag", () => {
  it("round-trips a lead id", () => {
    expect(leadTag(ID)).toBe(`vt-${ID}`);
    expect(parseLeadTag(leadTag(ID))).toBe(ID);
  });

  it("rejects anything that isn't our tag around a uuid", () => {
    expect(parseLeadTag(ID)).toBeNull();
    expect(parseLeadTag("vt-not-a-uuid")).toBeNull();
    expect(parseLeadTag("newsletter")).toBeNull();
    expect(parseLeadTag(null)).toBeNull();
    expect(parseLeadTag(`vt-${ID}; drop table`)).toBeNull();
  });
});

describe("tagBookingUrl", () => {
  it("adds our tag as utm_content, keeping the seller's own params", async () => {
    const { tagBookingUrl } = await import("./tag");
    const out = new URL(tagBookingUrl("https://calendly.com/acme/intro?month=2026-11", ID));
    expect(out.searchParams.get("utm_content")).toBe(`vt-${ID}`);
    expect(out.searchParams.get("metadata[vt]")).toBe(`vt-${ID}`); // Cal.com's echoed key
    expect(out.searchParams.get("month")).toBe("2026-11");
  });

  it("replaces a stale tag instead of stacking", async () => {
    const { tagBookingUrl } = await import("./tag");
    const out = new URL(tagBookingUrl(`https://cal.com/acme/30min?utm_content=vt-old`, ID));
    expect(out.searchParams.getAll("utm_content")).toEqual([`vt-${ID}`]);
  });

  it("leaves a malformed URL untouched", async () => {
    const { tagBookingUrl } = await import("./tag");
    expect(tagBookingUrl("not a url", ID)).toBe("not a url");
  });
});

describe("tagLinksInText", () => {
  it("tags every occurrence of the booking link in a drafted message", async () => {
    const { tagLinksInText } = await import("./tag");
    const msg = "Easiest is to grab a slot here: https://calendly.com/acme/intro. Or https://calendly.com/acme/intro works too!";
    const out = tagLinksInText(msg, "https://calendly.com/acme/intro", ID);
    expect(out.match(/utm_content=vt-/g)).toHaveLength(2);
    expect(out).toContain(`metadata%5Bvt%5D=vt-${ID}. Or`); // trailing period stays text
  });

  it("leaves the message alone when there's no booking link or it isn't in the text", async () => {
    const { tagLinksInText } = await import("./tag");
    expect(tagLinksInText("Thanks!", "https://calendly.com/acme/intro", ID)).toBe("Thanks!");
    expect(tagLinksInText("See https://x.com", null, ID)).toBe("See https://x.com");
  });

  it("does not re-tag an already tagged link", async () => {
    const { tagLinksInText, tagBookingUrl } = await import("./tag");
    const tagged = tagBookingUrl("https://cal.com/acme/30min", ID);
    expect(tagLinksInText(`Book: ${tagged}`, "https://cal.com/acme/30min", ID)).toBe(`Book: ${tagged}`);
  });
});

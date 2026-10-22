import { describe, expect, it } from "vitest";
import { replyIntent } from "./inbox-intent";

describe("replyIntent", () => {
  it("booked outranks the last reply's classification", () => {
    expect(replyIntent({ booked: true, lastClassification: "neutral" })).toEqual({ label: "Booked", tone: "positive" });
  });
  it("tags interested, not-interested, opt-out and out-of-office replies", () => {
    expect(replyIntent({ booked: false, lastClassification: "interested" })?.label).toBe("Interested");
    expect(replyIntent({ booked: false, lastClassification: "not_interested" })?.label).toBe("Not interested");
    expect(replyIntent({ booked: false, lastClassification: "unsubscribe" })?.label).toBe("Opted out");
    expect(replyIntent({ booked: false, lastClassification: "out_of_office" })?.label).toBe("Out of office");
  });
  it("shows no tag for neutral/other replies or a thread with no reply yet", () => {
    expect(replyIntent({ booked: false, lastClassification: "neutral" })).toBeNull();
    expect(replyIntent({ booked: false, lastClassification: "other" })).toBeNull();
    expect(replyIntent({ booked: false, lastClassification: null })).toBeNull();
  });
});

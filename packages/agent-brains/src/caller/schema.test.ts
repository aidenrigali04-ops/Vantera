import { describe, expect, it } from "vitest";
import { callBriefSchema, callOutcomeSchema } from "./schema";

describe("caller schemas", () => {
  it("accepts a well-formed brief", () => {
    const r = callBriefSchema.safeParse({
      opening_line: "Hi, this is Alex from Acme.",
      talking_points: ["churn is high"],
      objection_handling: ["if busy, offer a callback"],
      goal_statement: "book a 15-min intro",
    });
    expect(r.success).toBe(true);
  });

  it("rejects an empty opening line", () => {
    const r = callBriefSchema.safeParse({ opening_line: "", talking_points: [], objection_handling: [], goal_statement: "x" });
    expect(r.success).toBe(false);
  });

  it("constrains outcome to the canonical enum", () => {
    expect(callOutcomeSchema.safeParse({ outcome: "booked" }).success).toBe(true);
    expect(callOutcomeSchema.safeParse({ outcome: "maybe" }).success).toBe(false);
  });
});

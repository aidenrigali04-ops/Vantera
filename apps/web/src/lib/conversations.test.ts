import { describe, expect, it } from "vitest";
import { nativeAsSent } from "./conversations";

describe("nativeAsSent — messages typed natively in LinkedIn join the thread (0073)", () => {
  it("renders them as the seller's manual turns at the time they were sent", () => {
    expect(
      nativeAsSent([{ lead_id: "l1", body: "Jumping in personally here", sent_at: "2026-10-23T06:44:08Z" }])
    ).toEqual([
      {
        lead_id: "l1",
        body: "Jumping in personally here",
        updated_at: "2026-10-23T06:44:08Z",
        origin: "manual",
        recipe: null,
        linkedin_stage: "message",
      },
    ]);
  });
});

import { describe, expect, it } from "vitest";
import { meetingSourceLabel } from "./meeting-source";

describe("meetingSourceLabel", () => {
  it("names how the meeting was recorded", () => {
    expect(meetingSourceLabel("calendar")).toBe("booked through your scheduling link");
    expect(meetingSourceLabel("agent")).toBe("detected from the reply");
    expect(meetingSourceLabel("manual")).toBe("marked by you");
    expect(meetingSourceLabel(null)).toBe("marked by you");
  });
});

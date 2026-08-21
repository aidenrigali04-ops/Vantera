import { describe, expect, it } from "vitest";
import { computeOutreachFunnel } from "./funnel";
import { diagnoseOutreach } from "./diagnose";

const diag = (i: Parameters<typeof computeOutreachFunnel>[0]) =>
  diagnoseOutreach(computeOutreachFunnel(i));

describe("diagnoseOutreach", () => {
  it("stays silent when no stage has enough data (honest cold-start)", () => {
    expect(diag({ invited: 5, accepted: 2, interestedReplies: 0, booked: 0, closed: 0 }).status).toBe(
      "insufficient_data"
    );
  });

  it("names the single below-band stage that has enough data", () => {
    // acceptance healthy (40%), reply badly below (2/40 = 5% < 12)
    const d = diag({ invited: 100, accepted: 40, interestedReplies: 2, booked: 0, closed: 0 });
    expect(d.status).toBe("leak");
    expect(d.stageKey).toBe("reply");
  });

  it("reports healthy when every gated stage sits in or above band", () => {
    // acceptance 40% + reply 20% are gated and healthy; booking/close denominators stay under the
    // sample gate so they are not judged.
    const d = diag({ invited: 100, accepted: 40, interestedReplies: 8, booked: 2, closed: 1 });
    expect(d.status).toBe("healthy");
  });

  it("picks the stage furthest below its typical low when several leak", () => {
    // acceptance 20% (gap 5, n=100), reply 5% (gap 7, n=20 → just gated) → reply is the bigger leak
    const d = diag({ invited: 100, accepted: 20, interestedReplies: 1, booked: 0, closed: 0 });
    expect(d.status).toBe("leak");
    expect(d.stageKey).toBe("reply");
  });

  it("marks a small-but-sufficient sample as 'early' confidence", () => {
    const d = diag({ invited: 30, accepted: 3, interestedReplies: 0, booked: 0, closed: 0 });
    expect(d.status).toBe("leak");
    expect(d.stageKey).toBe("acceptance"); // 10% < 25, n=30 (≥20 but <50)
    expect(d.confidence).toBe("early");
  });
});

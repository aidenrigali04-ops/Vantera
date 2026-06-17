import { describe, expect, it } from "vitest";
import { assessMailboxHealth } from "./deliverability";

// Domain burnout is a top cancellation cause (report #5). This pure assessment turns a mailbox's
// rolling sent/bounce/complaint counts into a health status + the action the scheduler takes.
describe("assessMailboxHealth", () => {
  it("is healthy at low bounce/complaint rates", () => {
    const h = assessMailboxHealth({ sent: 100, bounces: 1, complaints: 0 });
    expect(h.status).toBe("healthy");
    expect(h.action).toBe("continue");
  });

  it("flags watch when the bounce rate crosses the watch floor", () => {
    const h = assessMailboxHealth({ sent: 100, bounces: 5, complaints: 0 }); // 5%
    expect(h.status).toBe("watch");
    expect(h.action).toBe("throttle");
  });

  it("burns the mailbox on a high bounce rate", () => {
    const h = assessMailboxHealth({ sent: 100, bounces: 9, complaints: 0 }); // 9%
    expect(h.status).toBe("burned");
    expect(h.action).toBe("rotate");
  });

  it("burns on a complaint rate over the spam-complaint floor", () => {
    const h = assessMailboxHealth({ sent: 1000, bounces: 0, complaints: 4 }); // 0.4%
    expect(h.status).toBe("burned");
  });

  it("stays healthy below the minimum sample (no false burn on tiny volume)", () => {
    const h = assessMailboxHealth({ sent: 5, bounces: 1, complaints: 0 }); // 20% but n < min
    expect(h.status).toBe("healthy");
    expect(h.action).toBe("continue");
  });
});

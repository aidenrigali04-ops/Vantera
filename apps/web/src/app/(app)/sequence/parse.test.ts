import { describe, expect, it } from "vitest";
import { parseSequenceForm } from "./parse";
import { SEQUENCE_DEFAULTS } from "@vantera/jobs/pipeline/sequence-config";

function form(entries: Record<string, string>): FormData {
  const fd = new FormData();
  for (const [k, v] of Object.entries(entries)) fd.set(k, v);
  return fd;
}

describe("parseSequenceForm", () => {
  it("parses per-stage touches/gaps/waits and enabled flags", () => {
    const cfg = parseSequenceForm(
      form({
        "linkedin.enabled": "on",
        "linkedin.touches": "2",
        "linkedin.touchGapDays": "2",
        "linkedin.waitDays": "3",
        "email.enabled": "on",
        "email.touches": "2",
        "email.touchGapDays": "2",
        "email.waitDays": "3",
        "imessage.touches": "1",
        "imessage.touchGapDays": "2",
        "imessage.waitDays": "2",
        "call.enabled": "on",
        "call.maxAttempts": "2",
        "call.touchGapDays": "2",
        "call.waitDays": "2",
      })
    );
    expect(cfg.stages.linkedin).toMatchObject({ enabled: true, touches: 2, waitDays: 3 });
    expect(cfg.stages.imessage.enabled).toBe(false); // checkbox not "on"
    expect(cfg.stages.call.maxAttempts).toBe(2);
    expect(cfg.order).toEqual(["linkedin", "email", "imessage", "call"]);
  });

  it("clamps caller attempts to 1-3 and touches to 0-5", () => {
    const cfg = parseSequenceForm(form({ "call.maxAttempts": "99", "linkedin.touches": "50" }));
    expect(cfg.stages.call.maxAttempts).toBe(3);
    expect(cfg.stages.linkedin.touches).toBe(5);
  });

  it("falls back to defaults for missing numeric fields", () => {
    const cfg = parseSequenceForm(form({}));
    expect(cfg.stages.email.touches).toBe(SEQUENCE_DEFAULTS.stages.email.touches);
    expect(cfg.stages.email.waitDays).toBe(SEQUENCE_DEFAULTS.stages.email.waitDays);
  });
});

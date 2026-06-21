import { describe, expect, it } from "vitest";
import { parseSequenceForm } from "./parse";
import { SEQUENCE_DEFAULTS } from "@vantera/jobs/pipeline/sequence-config";

function form(entries: Record<string, string>): FormData {
  const fd = new FormData();
  for (const [k, v] of Object.entries(entries)) fd.set(k, v);
  return fd;
}

describe("parseSequenceForm", () => {
  it("parses LinkedIn touches/gaps/waits and the enabled flag", () => {
    const cfg = parseSequenceForm(
      form({
        "linkedin.enabled": "on",
        "linkedin.touches": "2",
        "linkedin.touchGapDays": "2",
        "linkedin.waitDays": "3",
      })
    );
    expect(cfg.stages.linkedin).toMatchObject({ enabled: true, touches: 2, waitDays: 3 });
    expect(cfg.order).toEqual(["linkedin"]);
  });

  it("clamps touches to 0-5", () => {
    const cfg = parseSequenceForm(form({ "linkedin.touches": "50" }));
    expect(cfg.stages.linkedin.touches).toBe(5);
  });

  it("falls back to defaults for missing numeric fields", () => {
    const cfg = parseSequenceForm(form({}));
    expect(cfg.stages.linkedin.touches).toBe(SEQUENCE_DEFAULTS.stages.linkedin.touches);
    expect(cfg.stages.linkedin.waitDays).toBe(SEQUENCE_DEFAULTS.stages.linkedin.waitDays);
  });
});

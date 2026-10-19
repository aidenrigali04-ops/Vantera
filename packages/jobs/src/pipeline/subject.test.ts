import { describe, expect, it } from "vitest";
import {
  MAX_HARM_TOLERANCE,
  draftFirstSubject,
  parseSubjectForm,
  subjectConfig,
  taskForDueAgent,
} from "./subject";

function form(fields: Record<string, string>): FormData {
  const data = new FormData();
  for (const [key, value] of Object.entries(fields)) data.set(key, value);
  return data;
}

describe("parseSubjectForm", () => {
  it("accepts a name and keeps harm tolerance inside the floor", () => {
    const parsed = parseSubjectForm(form({ name: "Mid-market", harm_tolerance: "0.1", auto_adopt: "on" }));
    expect(parsed.ok).toBe(true);
    if (!parsed.ok) return;
    expect(parsed.values.name).toBe("Mid-market");
    expect(parsed.values.guardrails.harmTolerance).toBe(0.1);
    expect(parsed.values.guardrails.autoAdopt).toBe(true);
    expect(parsed.values.guardrails.maxConcurrentExperiments).toBe(1);
  });

  it("rejects a harm tolerance above the floor", () => {
    const parsed = parseSubjectForm(form({ name: "Mid-market", harm_tolerance: String(MAX_HARM_TOLERANCE + 0.01) }));
    expect(parsed.ok).toBe(false);
  });

  it("rejects an empty name", () => {
    expect(parseSubjectForm(form({ name: "  " })).ok).toBe(false);
  });
});

describe("draftFirstSubject", () => {
  it("names the subject from the workspace and uses the default guardrails", () => {
    const draft = draftFirstSubject("  Acme  ");
    expect(draft.name).toBe("Acme learning");
    expect(draft.guardrails.autoAdopt).toBe(false);
    expect(draft.guardrails.harmTolerance).toBe(MAX_HARM_TOLERANCE);
    expect(draft.guardrails.maxConcurrentExperiments).toBe(1);
  });

  it("falls back when the workspace has no name", () => {
    expect(draftFirstSubject("  ").name).toBe("Learning");
  });
});

describe("subjectConfig", () => {
  it("records guardrails and leaves bootstrap unset", () => {
    const config = subjectConfig(draftFirstSubject("Acme"));
    expect(config).toMatchObject({
      enabled: true,
      active_strategy_id: null,
      auto_adopt: false,
      max_concurrent_experiments: 1,
      bootstrap_completed_at: null,
    });
    expect(config.guardrails).toEqual({
      max_concurrent_experiments: 1,
      harm_tolerance: MAX_HARM_TOLERANCE,
      auto_adopt: false,
    });
  });
});

describe("taskForDueAgent", () => {
  it("sends a due optimizer to its own task", () => {
    expect(taskForDueAgent("optimizer")).toBe("optimizer");
    expect(taskForDueAgent("intent")).toBe("intent-scan");
    expect(taskForDueAgent("scout")).toBe("scout-run");
  });

  it("does not send any other kind out as a scout", () => {
    expect(taskForDueAgent("copy")).toBeNull();
  });
});

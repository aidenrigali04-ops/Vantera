import { describe, expect, it } from "vitest";
import { intentEditValues } from "./intent-edit-values";

const row = (config: unknown) => ({ name: "Sonar", config, run_at_time: "09:30:00", cadence: null, timezone: null });

describe("intentEditValues", () => {
  it("treats a missing signal key as on (onboarding agents have no follows key)", () => {
    const v = intentEditValues(row({ watch: { keywords: ["churn"] }, signals: { engagement: true, content: false } }));
    expect(v.signals).toEqual({ engagement: true, content: false, follows: true });
  });

  it("maps watch lists, trims the run time, and defaults cadence and timezone", () => {
    const v = intentEditValues(row({ watch: { keywords: ["churn", 3], hashtags: ["#cs"] } }));
    expect(v).toEqual({
      name: "Sonar",
      watch: { creators: [], competitors: [], keywords: ["churn"], hashtags: ["#cs"] },
      signals: { engagement: true, content: true, follows: true },
      runAtTime: "09:30",
      cadence: "daily",
      timezone: "UTC",
    });
  });

  it("survives a null config", () => {
    expect(intentEditValues(row(null)).watch.keywords).toEqual([]);
  });
});

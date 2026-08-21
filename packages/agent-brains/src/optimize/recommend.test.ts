import { describe, expect, it } from "vitest";
import { recommendForDiagnosis } from "./recommend";
import type { OutreachDiagnosis } from "./diagnose";

const leak = (stageKey: OutreachDiagnosis["stageKey"], confidence: "early" | "clear" = "clear"): OutreachDiagnosis => ({
  status: "leak",
  stageKey,
  headline: "",
  detail: "",
  confidence,
});

describe("recommendForDiagnosis", () => {
  it("returns null when there is no leak to act on", () => {
    expect(
      recommendForDiagnosis({ status: "healthy", headline: "", detail: "", confidence: "clear" })
    ).toBeNull();
    expect(
      recommendForDiagnosis({ status: "insufficient_data", headline: "", detail: "", confidence: "early" })
    ).toBeNull();
  });

  it("maps each leak stage to a single lever + a real owner control", () => {
    const acc = recommendForDiagnosis(leak("acceptance"))!;
    expect(acc.lever).toBe("targeting");
    expect(acc.action?.href).toBe("/agents/scout/edit");

    const reply = recommendForDiagnosis(leak("reply"))!;
    expect(reply.lever).toBe("content_cta");
    expect(reply.action?.href).toBe("/agents/copy/edit");

    const book = recommendForDiagnosis(leak("booking"))!;
    expect(book.lever).toBe("cta");
    expect(book.action?.href).toBe("/agents/copy/edit");
  });

  it("returns an advisory (no action) recommendation for a close-stage leak", () => {
    const close = recommendForDiagnosis(leak("close"))!;
    expect(close.action).toBeNull();
    expect(close.lever).toBe("sales_process");
  });

  it("carries the diagnosis confidence through", () => {
    expect(recommendForDiagnosis(leak("reply", "early"))!.confidence).toBe("early");
  });
});

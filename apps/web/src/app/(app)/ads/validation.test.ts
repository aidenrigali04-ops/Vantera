import { describe, expect, it } from "vitest";
import { parseAdForm, AD_VARIANTS_MAX } from "./validation";

function adForm(overrides: Record<string, string> = {}): FormData {
  const fd = new FormData();
  fd.set("name", "Q3 demo push");
  fd.set("offer", "a free pipeline teardown");
  fd.set("targetIcp", "VP Sales at 50–500-person SaaS companies");
  fd.set("cta", "book a 15-minute teardown");
  fd.set("variants", "3");
  for (const [k, v] of Object.entries(overrides)) fd.set(k, v);
  return fd;
}

describe("parseAdForm", () => {
  it("parses a complete form", () => {
    expect(parseAdForm(adForm())).toEqual({
      ok: true,
      values: {
        name: "Q3 demo push",
        offer: "a free pipeline teardown",
        targetIcp: "VP Sales at 50–500-person SaaS companies",
        cta: "book a 15-minute teardown",
        variants: 3,
      },
    });
  });

  it("defaults variants to 3 and caps them", () => {
    const fd = adForm();
    fd.delete("variants");
    expect(parseAdForm(fd)).toMatchObject({ values: { variants: 3 } });
    expect(parseAdForm(adForm({ variants: String(AD_VARIANTS_MAX + 1) })).ok).toBe(false);
    expect(parseAdForm(adForm({ variants: "0" })).ok).toBe(false);
  });

  it("requires name, offer, target, and cta", () => {
    expect(parseAdForm(adForm({ name: "" })).ok).toBe(false);
    expect(parseAdForm(adForm({ offer: "x" })).ok).toBe(false);
    expect(parseAdForm(adForm({ targetIcp: "x" })).ok).toBe(false);
    expect(parseAdForm(adForm({ cta: "x" })).ok).toBe(false);
  });
});

import { describe, expect, it } from "vitest";
import { ICP_SIZE_BUCKETS } from "@vantera/agent-brains";
import { BUYERS_SIZE_BUCKETS, parseBuyersForm } from "./buyers";

function form(fields: Record<string, string | string[]>): FormData {
  const fd = new FormData();
  for (const [key, value] of Object.entries(fields)) {
    for (const v of Array.isArray(value) ? value : [value]) fd.append(key, v);
  }
  return fd;
}

const DRAFTED = {
  name: "Heads of Sales · B2B SaaS",
  "titles[]": ["VP of Sales", "Head of Growth"],
  "industries[]": ["Software Development"],
  "companySizes[]": ["11-50", "51-200"],
  "geos[]": ["United States"],
  "signals[]": ["hiring SDRs"],
  excludeAgencies: "on",
  excludeFreelancers: "on",
};

describe("parseBuyersForm", () => {
  it("accepts the drafted shape and trims/dedupes chips", () => {
    const res = parseBuyersForm(
      form({ ...DRAFTED, "titles[]": ["  VP of Sales ", "vp of sales", "Head  of Growth", ""] })
    );
    expect(res.ok).toBe(true);
    if (!res.ok) return;
    expect(res.values.name).toBe("Heads of Sales · B2B SaaS");
    expect(res.values.criteria).toEqual({
      titles: ["VP of Sales", "Head of Growth"],
      industries: ["Software Development"],
      companySizes: ["11-50", "51-200"],
      geos: ["United States"],
      signals: ["hiring SDRs"],
    });
  });

  it("rejects a size outside ICP_SIZE_BUCKETS", () => {
    const res = parseBuyersForm(form({ ...DRAFTED, "companySizes[]": ["11-50", "50-200"] }));
    expect(res.ok).toBe(false);
  });

  it("caps titles at 6 and entries at 60 chars", () => {
    const titles = ["A1", "A2", "A3", "A4", "A5", "A6", "A7", "A8"];
    const long = "x".repeat(90);
    const res = parseBuyersForm(form({ ...DRAFTED, "titles[]": titles, "geos[]": [long] }));
    expect(res.ok).toBe(true);
    if (!res.ok) return;
    expect(res.values.criteria.titles).toEqual(titles.slice(0, 6));
    expect(res.values.criteria.geos[0]).toHaveLength(60);
  });

  it("defaults exclusions to agencies+freelancers on", () => {
    const rest: Record<string, string | string[]> = { ...DRAFTED };
    delete rest.excludeAgencies;
    delete rest.excludeFreelancers;
    const absent = parseBuyersForm(form(rest));
    expect(absent.ok && absent.values.targeting.excludeAgencies).toBe(true);
    expect(absent.ok && absent.values.targeting.excludeFreelancers).toBe(true);

    const off = parseBuyersForm(form({ ...rest, excludeAgencies: "off", excludeFreelancers: "off" }));
    expect(off.ok && off.values.targeting.excludeAgencies).toBe(false);
    expect(off.ok && off.values.targeting.excludeFreelancers).toBe(false);
  });

  it("passes guidance through parseTargetingForm limits", () => {
    const ok = parseBuyersForm(form({ ...DRAFTED, guidance: "  Prioritize founders.  ", competitors: "Acme\nGlobex" }));
    expect(ok.ok).toBe(true);
    if (ok.ok) {
      expect(ok.values.targeting.guidance).toBe("Prioritize founders.");
      expect(ok.values.targeting.competitors).toEqual(["Acme", "Globex"]);
    }
    expect(parseBuyersForm(form({ ...DRAFTED, guidance: "x".repeat(501) })).ok).toBe(false);
  });

  it("keeps its size buckets in lockstep with the drafter", () => {
    expect([...BUYERS_SIZE_BUCKETS]).toEqual([...ICP_SIZE_BUCKETS]);
  });

  it("requires a profile name of 2 to 80 characters", () => {
    expect(parseBuyersForm(form({ ...DRAFTED, name: "x" })).ok).toBe(false);
    expect(parseBuyersForm(form({ ...DRAFTED, name: "x".repeat(81) })).ok).toBe(false);
  });
});

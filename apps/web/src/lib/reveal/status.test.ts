import { describe, expect, it } from "vitest";
import { buildRevealStatus, PREVIEW_SHOWN, type RevealMatchRow, type RevealRunRow } from "./status";

const NONE: ReadonlySet<string> = new Set();

const run: RevealRunRow = {
  status: "done",
  scanned: 42,
  gate_passed: 30,
  matched: 40,
  drafted: 5,
  error: null,
};

function match(i: number, score = 90 - i): RevealMatchRow {
  return {
    id: `lead_${i}`,
    first_name: "Maya",
    last_name: `Chen${i}`,
    title: "Head of Growth",
    company_name: "Northwind",
    ai_score: score,
    ai_rationale: "Strong title match. Also active recently.",
    ai_insights: { summary: "Posted about pipeline pain" },
  };
}

describe("buildRevealStatus — the pre-payment rules", () => {
  it("returns not_started without a run row", () => {
    expect(buildRevealStatus(null, [], [], NONE)).toEqual({ status: "not_started" });
  });

  it("caps shown matches at PREVIEW_SHOWN even with 40 qualified", () => {
    const rows = Array.from({ length: 40 }, (_, i) => match(i));
    const out = buildRevealStatus(run, rows, [], NONE);
    if (out.status === "not_started") throw new Error("unexpected");
    expect(out.matches).toHaveLength(PREVIEW_SHOWN);
    expect(out.matched).toBe(15); // display honesty: matched is clamped to the 15 surfaced cap
    // best-first
    expect(out.matches[0]!.score).toBeGreaterThanOrEqual(out.matches.at(-1)!.score);
  });

  it("exposes exactly one draft body, and none on the match rows", () => {
    const rows = [match(0), match(1)];
    const out = buildRevealStatus(run, rows, [{ lead_id: "lead_0", body: "Hi Maya —" }], NONE);
    if (out.status === "not_started") throw new Error("unexpected");
    expect(out.topDraft).toEqual({ leadId: "lead_0", body: "Hi Maya —" });
    for (const m of out.matches) {
      expect(Object.keys(m)).not.toContain("body");
      expect(Object.keys(m)).not.toContain("draft");
    }
  });

  it("topDraft is null when the draft row is missing or empty", () => {
    const a = buildRevealStatus(run, [match(0)], [], NONE);
    const b = buildRevealStatus(run, [match(0)], [{ lead_id: "lead_0", body: null }], NONE);
    if (a.status === "not_started" || b.status === "not_started") throw new Error("unexpected");
    expect(a.topDraft).toBeNull();
    expect(b.topDraft).toBeNull();
  });

  it("evidence falls back to the first rationale sentence when insights are missing", () => {
    const row: RevealMatchRow = { ...match(0), ai_insights: null };
    const out = buildRevealStatus(run, [row], [], NONE);
    if (out.status === "not_started") throw new Error("unexpected");
    expect(out.matches[0]!.evidenceLine).toBe("Strong title match.");
  });

  it("clamps raw error strings to 'internal' — only whitelisted codes reach the client", () => {
    const raw = { ...run, status: "failed" as const, error: "ExploriumError: 402 at https://api.vendor.example/credits" };
    const out = buildRevealStatus(raw, [], [], NONE);
    if (out.status === "not_started") throw new Error("unexpected");
    expect(out.error).toBe("internal");

    const noIcp = buildRevealStatus({ ...run, status: "failed", error: "no_icp" }, [], [], NONE);
    if (noIcp.status === "not_started") throw new Error("unexpected");
    expect(noIcp.error).toBe("no_icp");

    const credits = buildRevealStatus({ ...run, status: "failed", error: "low_credits" }, [], [], NONE);
    if (credits.status === "not_started") throw new Error("unexpected");
    expect(credits.error).toBe("internal"); // platform economics stay internal
  });

  it("drops unscored rows", () => {
    const out = buildRevealStatus(run, [{ ...match(0), ai_score: null }], [], NONE);
    if (out.status === "not_started") throw new Error("unexpected");
    expect(out.matches).toHaveLength(0);
  });

  it("shows 5 and reports the remaining pool", () => {
    const rows = Array.from({ length: 9 }, (_, i) => match(i));
    const out = buildRevealStatus(run, rows, [], NONE);
    if (out.status === "not_started") throw new Error("unexpected");
    expect(out.matches).toHaveLength(5);
    expect(out.poolRemaining).toBe(4);
  });

  it("a rejected lead is replaced by the next scored lead and never supplies the draft", () => {
    const rows = Array.from({ length: 9 }, (_, i) => match(i));
    const drafts = [{ lead_id: "lead_0", body: "Hi Chen0" }];
    const out = buildRevealStatus(run, rows, drafts, new Set(["lead_0"]));
    if (out.status === "not_started") throw new Error("unexpected");
    expect(out.matches[0]!.leadId).toBe("lead_1");
    expect(out.matches.map((m) => m.leadId)).not.toContain("lead_0");
    expect(out.matches).toHaveLength(5);
    expect(out.topDraft).toBeNull(); // new top has no body; rejected lead's body never leaks

    const withNew = buildRevealStatus(run, rows, [...drafts, { lead_id: "lead_1", body: "Hi Chen1" }], new Set(["lead_0"]));
    if (withNew.status === "not_started") throw new Error("unexpected");
    expect(withNew.topDraft).toEqual({ leadId: "lead_1", body: "Hi Chen1" });
  });

  it("pool exhausted", () => {
    const rows = Array.from({ length: 5 }, (_, i) => match(i));
    const out = buildRevealStatus(run, rows, [], new Set(["lead_2"]));
    if (out.status === "not_started") throw new Error("unexpected");
    expect(out.matches).toHaveLength(4);
    expect(out.poolRemaining).toBe(0);
  });
});

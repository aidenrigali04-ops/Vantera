import { describe, expect, it } from "vitest";
import { buildRevealStatus, REVEAL_SURFACED_CAP, type RevealMatchRow, type RevealRunRow } from "./status";

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
    expect(buildRevealStatus(null, [], null)).toEqual({ status: "not_started" });
  });

  it("caps surfaced matches at REVEAL_SURFACED_CAP even with 40 qualified", () => {
    const rows = Array.from({ length: 40 }, (_, i) => match(i));
    const out = buildRevealStatus(run, rows, null);
    if (out.status === "not_started") throw new Error("unexpected");
    expect(out.matches).toHaveLength(REVEAL_SURFACED_CAP);
    expect(out.matched).toBe(REVEAL_SURFACED_CAP); // display honesty: claim only what's shown
    // best-first
    expect(out.matches[0]!.score).toBeGreaterThanOrEqual(out.matches.at(-1)!.score);
  });

  it("exposes exactly one draft body, and none on the match rows", () => {
    const rows = [match(0), match(1)];
    const out = buildRevealStatus(run, rows, { lead_id: "lead_0", body: "Hi Maya —" });
    if (out.status === "not_started") throw new Error("unexpected");
    expect(out.topDraft).toEqual({ leadId: "lead_0", body: "Hi Maya —" });
    for (const m of out.matches) {
      expect(Object.keys(m)).not.toContain("body");
      expect(Object.keys(m)).not.toContain("draft");
    }
  });

  it("topDraft is null when the draft row is missing or empty", () => {
    const a = buildRevealStatus(run, [match(0)], null);
    const b = buildRevealStatus(run, [match(0)], { lead_id: "x", body: null });
    if (a.status === "not_started" || b.status === "not_started") throw new Error("unexpected");
    expect(a.topDraft).toBeNull();
    expect(b.topDraft).toBeNull();
  });

  it("evidence falls back to the first rationale sentence when insights are missing", () => {
    const row: RevealMatchRow = { ...match(0), ai_insights: null };
    const out = buildRevealStatus(run, [row], null);
    if (out.status === "not_started") throw new Error("unexpected");
    expect(out.matches[0]!.evidenceLine).toBe("Strong title match.");
  });

  it("clamps raw error strings to 'internal' — only whitelisted codes reach the client", () => {
    const raw = { ...run, status: "failed" as const, error: "ExploriumError: 402 at https://api.vendor.example/credits" };
    const out = buildRevealStatus(raw, [], null);
    if (out.status === "not_started") throw new Error("unexpected");
    expect(out.error).toBe("internal");

    const noIcp = buildRevealStatus({ ...run, status: "failed", error: "no_icp" }, [], null);
    if (noIcp.status === "not_started") throw new Error("unexpected");
    expect(noIcp.error).toBe("no_icp");

    const credits = buildRevealStatus({ ...run, status: "failed", error: "low_credits" }, [], null);
    if (credits.status === "not_started") throw new Error("unexpected");
    expect(credits.error).toBe("internal"); // platform economics stay internal
  });

  it("drops unscored rows", () => {
    const out = buildRevealStatus(run, [{ ...match(0), ai_score: null }], null);
    if (out.status === "not_started") throw new Error("unexpected");
    expect(out.matches).toHaveLength(0);
  });
});

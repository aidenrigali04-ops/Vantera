import { describe, expect, it } from "vitest";
import { signalGroups, whyNowCell } from "./why-now-cell";

const now = new Date("2026-06-16T12:00:00Z");
const sig = (kind: string, label: string, observed_at: string | null) => ({ kind, label, observed_at });

describe("whyNowCell", () => {
  it("picks the newest signal", () => {
    const c = whyNowCell(
      [sig("hiring", "Hiring SDRs", "2026-06-01T00:00:00Z"), sig("funding", "Raised Series A", "2026-06-15T00:00:00Z")],
      [],
      null,
      now,
    );
    expect(c).toMatchObject({ label: "Raised Series A", kind: "funding", more: 1 });
  });

  it("buckets when", () => {
    const w = (iso: string) => whyNowCell([sig("a", "x", iso)], [], null, now)?.when;
    expect(w("2026-06-16T08:00:00Z")).toBe("today");
    expect(w("2026-06-13T12:00:00Z")).toBe("3d ago");
    expect(w("2026-06-02T12:00:00Z")).toBe("2w ago");
    expect(w("2026-03-16T12:00:00Z")).toBe("3mo ago");
  });

  it("href only for http(s) post refs", () => {
    const post = (post_ref: string) => ({ post_ref, headline: null, detail: null, observed_at: "2026-06-15T00:00:00Z" });
    const s = [sig("intent", "Intent", "2026-06-15T00:00:00Z")];
    expect(whyNowCell(s, [post("https://linkedin.com/posts/x")], null, now)?.href).toBe("https://linkedin.com/posts/x");
    expect(whyNowCell(s, [post("follow")], null, now)?.href).toBeNull();
    expect(whyNowCell(s, [post("urn:li:activity:1")], null, now)?.href).toBeNull();
  });

  it("uses the newest intent post for href", () => {
    const posts = [
      { post_ref: "https://old.example/1", headline: null, detail: null, observed_at: "2026-06-01T00:00:00Z" },
      { post_ref: "https://new.example/2", headline: null, detail: null, observed_at: "2026-06-14T00:00:00Z" },
    ];
    expect(whyNowCell([sig("intent", "I", "2026-06-14T00:00:00Z")], posts, null, now)?.href).toBe("https://new.example/2");
  });

  it("falls back to insights", () => {
    expect(whyNowCell([], [], { triggers: ["New VP Sales"] }, now)).toEqual({
      label: "New VP Sales",
      when: null,
      href: null,
      kind: null,
      level: null,
      more: 0,
    });
  });

  it("null when nothing", () => {
    expect(whyNowCell([], [], null, now)).toBeNull();
    expect(whyNowCell([], [], { triggers: [], pain_points: [] }, now)).toBeNull();
  });
});

describe("signalGroups", () => {
  it("counts, sorts, and labels with fallback", () => {
    const g = signalGroups([{ kind: "funding" }, { kind: "zzz_unknown" }, { kind: "zzz_unknown" }]);
    expect(g.map((x) => x.count)).toEqual([2, 1]);
    expect(g[0].kind).toBe("zzz_unknown");
    expect(g[0].label).toBeTruthy();
    expect(g[1].label).not.toBe("");
  });
});

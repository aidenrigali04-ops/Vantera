import { describe, expect, it } from "vitest";
import { MockLanguageModelV3 } from "ai/test";
import { compactLead, freshSignals, rankLeads, RANK_BATCH_SIZE, type RankCandidate } from "./rank";
import type { LeadInsights } from "./schema";

function insight(leadId: string, overrides: Partial<LeadInsights> = {}): LeadInsights {
  return {
    lead_id: leadId,
    reasoning: "tight ICP fit with live hiring signal",
    score: 82,
    rationale: "VP Sales at a 40-person SaaS hiring SDRs now.",
    pain_points: ["pipeline coverage"],
    triggers: ["hiring 3 SDRs"],
    motivations: ["hit growth targets"],
    value_angle: "fills top-of-funnel without headcount",
    aha_moment: "qualified meetings landing on the calendar in week one",
    summary: "Strong fit. Hiring signal suggests budget and urgency.",
    ...overrides,
  };
}

function textResponse(json: unknown) {
  return {
    finishReason: { unified: "stop" as const, raw: "stop" },
    usage: { inputTokens: { total: 10, noCache: 10, cacheRead: 0, cacheWrite: 0 }, outputTokens: { total: 20, text: 20, reasoning: 0 } },
    content: [{ type: "text" as const, text: JSON.stringify(json) }],
    warnings: [],
  };
}

function sequence(...responses: ReturnType<typeof textResponse>[]) {
  let call = 0;
  return async () => responses[Math.min(call++, responses.length - 1)]!;
}

function candidate(leadId: string, overrides: Partial<RankCandidate> = {}): RankCandidate {
  return { leadId, companyName: "Acme", industry: "saas", title: "CTO", ...overrides };
}

describe("compactLead", () => {
  it("renders one stable pipe-delimited line", () => {
    const line = compactLead({
      leadId: "l1",
      companyName: "Acme",
      companySize: "11-50",
      industry: "saas",
      location: "us",
      title: "CTO",
      technographics: ["a", "b", "c", "d"],
      signals: [{ kind: "hiring", detail: "3 SDR roles" }],
    });
    expect(line).toBe("l1|Acme|11-50|saas|us|CTO|a,b,c|hiring:3 SDR roles");
  });

  it("truncates long fields and dashes out missing ones", () => {
    const line = compactLead({ leadId: "l1", companyName: "x".repeat(100) });
    const parts = line.split("|");
    expect(parts[1]).toHaveLength(60);
    expect(parts[1]!.endsWith("…")).toBe(true);
    expect(parts.slice(2)).toEqual(["-", "-", "-", "-", "-", "-"]);
  });

  it("drops stale timing signals so the model doesn't treat a 2022 event as 'active'", () => {
    const now = new Date("2026-06-16T00:00:00Z");
    const day = 86_400_000;
    const line = compactLead(
      {
        leadId: "l1",
        signals: [
          { kind: "hiring", detail: "fresh", observedAt: new Date(now.getTime() - 10 * day).toISOString() },
          { kind: "funding", detail: "old", observedAt: new Date(now.getTime() - 300 * day).toISOString() },
        ],
      },
      now
    );
    expect(line).toContain("hiring:fresh");
    expect(line).not.toContain("funding:old");
  });
});

describe("freshSignals", () => {
  const now = new Date("2026-06-16T00:00:00Z");
  const daysAgo = (n: number) => new Date(now.getTime() - n * 86_400_000).toISOString();

  it("drops a timing signal older than the freshness window", () => {
    expect(freshSignals([{ kind: "hiring", detail: "x", observedAt: daysAgo(200) }], now)).toEqual([]);
  });

  it("keeps recent + unknown-age signals, newest first", () => {
    const out = freshSignals(
      [
        { kind: "old", detail: "a", observedAt: daysAgo(100) },
        { kind: "new", detail: "b", observedAt: daysAgo(5) },
        { kind: "unknown", detail: "c" },
      ],
      now
    );
    expect(out.map((s) => s.kind)).toEqual(["new", "old", "unknown"]);
  });
});

describe("rankLeads", () => {
  it("parses structured output and maps lead ids back", async () => {
    const model = new MockLanguageModelV3({
      doGenerate: textResponse({ leads: [insight("l1"), insight("ghost")] }),
    });

    const out = await rankLeads([candidate("l1")], {}, model);

    expect(out).toHaveLength(1);
    expect(out[0]!.lead_id).toBe("l1");
    expect(out[0]!.score).toBe(82);
  });

  it("splits candidates into batches of RANK_BATCH_SIZE", async () => {
    const candidates = Array.from({ length: RANK_BATCH_SIZE + 1 }, (_, i) => candidate(`l${i}`));
    const model = new MockLanguageModelV3({
      doGenerate: async (opts) => {
        const prompt = JSON.stringify(opts.prompt);
        const ids = candidates.filter((c) => prompt.includes(`${c.leadId}|`)).map((c) => c.leadId);
        return textResponse({ leads: ids.map((id) => insight(id)) });
      },
    });

    const out = await rankLeads(candidates, {}, model);

    expect(model.doGenerateCalls).toHaveLength(2);
    expect(out).toHaveLength(candidates.length);
  });

  it("retries once when the model returns schema-invalid output", async () => {
    const model = new MockLanguageModelV3({
      doGenerate: sequence(
        textResponse({ leads: [{ lead_id: "l1", score: "not a number" }] }),
        textResponse({ leads: [insight("l1")] })
      ),
    });

    const out = await rankLeads([candidate("l1")], {}, model);

    expect(model.doGenerateCalls).toHaveLength(2);
    expect(out[0]!.score).toBe(82);
  });

  it("rejects out-of-range scores via the schema", async () => {
    const model = new MockLanguageModelV3({
      doGenerate: sequence(
        textResponse({ leads: [insight("l1", { score: 140 })] }),
        textResponse({ leads: [insight("l1", { score: 140 })] })
      ),
    });

    await expect(rankLeads([candidate("l1")], {}, model)).rejects.toThrow();
  });

  it("sends seller context ahead of lead lines for prompt-cache-friendly ordering", async () => {
    const model = new MockLanguageModelV3({
      doGenerate: textResponse({ leads: [insight("l1")] }),
    });

    await rankLeads([candidate("l1")], { accountIndustry: "fintech", valueProp: "SDR agents" }, model);

    const userText = JSON.stringify(model.doGenerateCalls[0]!.prompt);
    expect(userText.indexOf("fintech")).toBeLessThan(userText.indexOf("l1|"));
  });
});

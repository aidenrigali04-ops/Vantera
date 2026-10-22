import { generateObject, type LanguageModel } from "ai";
import { z } from "zod";
import { registerPrompt } from "@vantera/ai";
import { ARENAS, type ArenaKey } from "../hive/arenas";
import type { Genome } from "../hive/genome";
import type { BrainContext, BrainFn, LibraryEntry, RawProposal } from "./brains";

/**
 * The deliberator proposes experiments by reading the verdict library. It sees the same
 * BrainContext as the rule brains. The governor still validates every proposal; illegal
 * values are returned to it as feedback on the next call, never coerced here.
 * One model call per generation. A failure returns nothing so the hive keeps moving.
 */

const ROLE = registerPrompt(
  "research/deliberator",
  `You are the strategist for one account's LinkedIn outreach. You propose experiments from that account's own record. ICP, brand, services, and value belong to the account; you do not invent a global setting.

You receive the current champion, values the funnel already knows how to run, a digest of past verdicts, your own recent rejection notes, and how elite strategies differ from the champion. The known values are information, not a limit.

Your job is to reach the best strategy this record can support. Prefer the combination of values that each showed a positive mean lift and are not yet in the champion. Also propose the smaller pairs and triples inside that combination, and any elite difference the one-gene rules have not raced as a package.

Propose up to the requested number of experiments. Each experiment has:
- strategy: the arenas and genes you change, as { arena: { gene: value } }. You may name a new gene or a new value when the record gives you a reason, and you may change as many genes as the idea needs.
- hypothesis: one sentence
- mechanism: cite this account's record (how often a value was tried, how often it was promoted, its mean lift, or a rejection pattern you can name). If the idea has no prior measurement, say so.
- predictedLift: your forecast of the gain in meetings per 100 sourced. This is a forecast, not a result.
- falsifyBelow: a number less than or equal to predictedLift. Set it where you would admit the idea failed.

The governor is the only judge. It runs the proposal and returns a verdict. You do not report a result. A value with no measured response is not recorded as a gain. Do not re-propose a change set already in the library. Output JSON only.`,
);

const proposalSchema = z.object({
  proposals: z.array(
    z.object({
      strategy: z.record(z.string(), z.record(z.string(), z.string())),
      hypothesis: z.string().default(""),
      mechanism: z.string().default(""),
      predictedLift: z.number(),
      falsifyBelow: z.number(),
    }),
  ),
});

export type TokenUsage = { calls: number; inputTokens: number; outputTokens: number };

/** The model usage object carries tokens, not dollars. Report cost from these list prices. */
export const TOKEN_USD = { inputPerMillion: 3, outputPerMillion: 15 };

export function tokenCostUsd(usage: TokenUsage): number {
  return (usage.inputTokens / 1_000_000) * TOKEN_USD.inputPerMillion + (usage.outputTokens / 1_000_000) * TOKEN_USD.outputPerMillion;
}

export type DeliberatorBundle = {
  champion: Record<string, Record<string, string>>;
  championScore: number;
  legalValues: Record<string, Record<string, readonly string[]>>;
  digest: { key: string; tried: number; promoted: number; meanLift: number; meanWorstLift: number }[];
  recentVerdicts: {
    id: string;
    brain: string;
    changes: LibraryEntry["changes"];
    lift: number;
    margin: number;
    worstLift: number;
    verdict: string;
    generation: number;
    reason: string;
  }[];
  scorecard: { promoted: number; rejected: number; falsified: number; flagged: number };
  feedback: { proposalId: string; outcome: string }[];
  elites: { score: number; diffs: { arena: string; gene: string; from: string; to: string }[] }[];
  untested: string[];
  limit: number;
};

const r3 = (x: number) => Math.round(x * 1000) / 1000;

function changeSignature(changes: { arena: string; gene: string; to: string }[]): string {
  return changes.map((c) => `${c.arena}|${c.gene}=${c.to}`).sort().join(";");
}

/** Signature of a partial strategy. Null when a value is not text (the governor will reject that shape). */
function signatureOf(champion: BrainContext["champion"], strategy: Record<string, Record<string, string>>): string | null {
  const parts: string[] = [];
  for (const [arena, genome] of Object.entries(strategy)) {
    if (!genome || typeof genome !== "object") return null;
    const base = champion[arena as ArenaKey];
    for (const [gene, value] of Object.entries(genome)) {
      if (typeof value !== "string" || !value.trim()) return null;
      if (base?.[gene] === value) continue;
      parts.push(`${arena}|${gene}=${value}`);
    }
  }
  return parts.sort().join(";");
}

export function buildDeliberatorBundle(ctx: BrainContext, n: number): DeliberatorBundle {
  const legalValues: DeliberatorBundle["legalValues"] = {};
  for (const arena of ctx.arenas) {
    legalValues[arena] = {};
    for (const [gene, spec] of Object.entries(ARENAS[arena].genes)) legalValues[arena]![gene] = spec.values;
  }

  const cells = new Map<string, { tried: number; promoted: number; liftSum: number; worstSum: number }>();
  for (const entry of ctx.library) {
    for (const change of entry.changes) {
      const key = `${change.arena}|${change.gene}=${change.to}`;
      const cell = cells.get(key) ?? { tried: 0, promoted: 0, liftSum: 0, worstSum: 0 };
      cell.tried++;
      if (entry.verdict === "promoted") cell.promoted++;
      cell.liftSum += entry.lift;
      cell.worstSum += entry.worstLift;
      cells.set(key, cell);
    }
  }
  const digest = [...cells.entries()].map(([key, cell]) => ({
    key,
    tried: cell.tried,
    promoted: cell.promoted,
    meanLift: r3(cell.liftSum / cell.tried),
    meanWorstLift: r3(cell.worstSum / cell.tried),
  }));

  const triedSingle = new Set(ctx.library.filter((e) => e.changes.length === 1).map((e) => changeSignature(e.changes)));
  const untested: string[] = [];
  for (const arena of ctx.arenas) {
    const genome = ctx.champion[arena];
    if (!genome) continue;
    for (const [gene, spec] of Object.entries(ARENAS[arena].genes)) {
      for (const value of spec.values) {
        if (value === genome[gene]) continue;
        const key = `${arena}|${gene}=${value}`;
        if (!triedSingle.has(key)) untested.push(key);
      }
    }
  }

  const mine = ctx.library.filter((e) => e.brain === "deliberator");
  const elites = ctx.elites.slice(0, 3).map((elite) => {
    const diffs: { arena: string; gene: string; from: string; to: string }[] = [];
    for (const arena of ctx.arenas) {
      const base = ctx.champion[arena];
      const alt = elite.strategy[arena] as Genome | undefined;
      if (!base || !alt) continue;
      for (const gene of Object.keys(base)) {
        if (base[gene] !== alt[gene] && alt[gene] !== undefined) diffs.push({ arena, gene, from: base[gene]!, to: alt[gene]! });
      }
    }
    return { score: elite.score, diffs };
  });

  return {
    champion: Object.fromEntries(ctx.arenas.map((arena) => [arena, { ...(ctx.champion[arena] ?? {}) }])),
    championScore: ctx.championScore,
    legalValues,
    digest,
    recentVerdicts: ctx.library.slice(-15).map((e) => ({
      id: e.id,
      brain: e.brain,
      changes: e.changes,
      lift: e.lift,
      margin: e.margin,
      worstLift: e.worstLift,
      verdict: e.verdict,
      generation: e.generation,
      reason: e.reason ?? "",
    })),
    scorecard: {
      promoted: mine.filter((e) => e.verdict === "promoted").length,
      rejected: mine.filter((e) => e.verdict === "rejected").length,
      falsified: mine.filter((e) => e.verdict === "falsified").length,
      flagged: mine.filter((e) => e.verdict === "flagged").length,
    },
    feedback: (ctx.feedback ?? []).map((f) => ({ proposalId: f.proposalId, outcome: f.outcome })),
    elites,
    untested,
    limit: n,
  };
}

let reportedFailure = false;

function reportFailure(err: unknown) {
  if (reportedFailure) return;
  reportedFailure = true;
  const message = err instanceof Error ? err.message : String(err);
  const cause = err instanceof Error && err.cause instanceof Error ? ` (${err.cause.message})` : "";
  console.error(`deliberator model call failed: ${message.slice(0, 600)}${cause.slice(0, 300)}`);
}

function readTokens(usage: unknown): { input: number; output: number } {
  if (!usage || typeof usage !== "object") return { input: 0, output: 0 };
  const row = usage as Record<string, unknown>;
  const input = typeof row.inputTokens === "number" ? row.inputTokens : typeof (row.inputTokens as { total?: unknown } | undefined)?.total === "number" ? ((row.inputTokens as { total: number }).total) : 0;
  const output = typeof row.outputTokens === "number" ? row.outputTokens : typeof (row.outputTokens as { total?: unknown } | undefined)?.total === "number" ? ((row.outputTokens as { total: number }).total) : 0;
  return { input, output };
}

export function makeDeliberator(model: LanguageModel, opts?: { maxTokens?: number }): BrainFn & { usage: TokenUsage } {
  const usage: TokenUsage = { calls: 0, inputTokens: 0, outputTokens: 0 };
  const fn = async (ctx: BrainContext, n: number): Promise<RawProposal[]> => {
    if (n <= 0) return [];
    const bundle = buildDeliberatorBundle(ctx, n);
    let generated: z.infer<typeof proposalSchema>;
    try {
      const result = await generateObject({
        model,
        schema: proposalSchema,
        system: ROLE.text,
        prompt: JSON.stringify(bundle),
        maxOutputTokens: opts?.maxTokens ?? 1200,
      });
      generated = result.object;
      const tokens = readTokens(result.usage);
      usage.calls++;
      usage.inputTokens += tokens.input;
      usage.outputTokens += tokens.output;
    } catch (err) {
      reportFailure(err);
      return [];
    }
    if (!generated.proposals?.length) return [];

    const librarySigs = new Set(ctx.library.map((e) => changeSignature(e.changes)));
    const batch = new Set<string>();
    const out: RawProposal[] = [];
    for (const raw of generated.proposals) {
      if (out.length >= n) break;
      const sig = signatureOf(ctx.champion, raw.strategy);
      if (sig && (librarySigs.has(sig) || batch.has(sig))) continue;
      if (sig) batch.add(sig);
      out.push({
        strategy: raw.strategy,
        hypothesis: raw.hypothesis,
        mechanism: raw.mechanism,
        predictedLift: raw.predictedLift,
        falsifyBelow: raw.falsifyBelow,
      });
    }
    return out;
  };
  return Object.assign(fn, { usage });
}

/**
 * Run the simulated-prospect conversations against the real models and write sim-seeded priors plus
 * eval fixtures.
 *
 *   pnpm --filter @vantera/agent-brains sim:conversation
 *
 * 7 personas x 6 seeds. Needs ANTHROPIC_API_KEY. Writes src/conversation/priors-sim.json and the first
 * 40 threads (persona-major order) to packages/evals/fixtures/conversation/sim-<persona>-<seed>.json.
 */
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { getModel } from "@vantera/ai";
import { composeMessage } from "../src/conversation/compose";
import { JUDGE_MODEL_ID } from "../src/copy/judge";
import { mulberry32 } from "../src/optimize/sim/harness";
import { shortlistMoves } from "../src/conversation/policy";
import { readTurn } from "../src/conversation/read";
import { legalMoves } from "../src/conversation/rules";
import { judgeSimThread } from "../src/conversation/sim/judge";
import { PERSONAS } from "../src/conversation/sim/personas";
import { runSimThread, simToPriors, type SimThread } from "../src/conversation/sim/run";
import type { Readout } from "../src/conversation/read";

const here = dirname(fileURLToPath(import.meta.url));
const pkg = resolve(here, "..");
const fixturesDir = resolve(pkg, "../evals/fixtures/conversation");
const SEEDS = [1, 2, 3, 4, 5, 6];
const FIXTURE_LIMIT = 40;

function suppressionOf(last: Readout | undefined): "none" | "written" {
  if (!last) return "none";
  return last.explicitOptOut || last.stance === "opt_out" || last.intent === "opts_out" ? "written" : "none";
}

function fixtureOf(t: SimThread) {
  const lastLeadIsLast = t.turns[t.turns.length - 1]?.role === "lead";
  const lastReadout = t.readouts[t.readouts.length - 1];
  const finalTrigger = lastLeadIsLast ? "reply" : "followup";
  // the grader rebuilds state with applyReadout only, so evaluate the final menu without the runner's lastMove
  const state = { ...t.finalState, lastMove: null };
  const { legal, vetoes } = legalMoves({
    state,
    trigger: finalTrigger,
    readout: lastLeadIsLast ? lastReadout : undefined,
    links: { booking: !!t.context.bookingUrl, website: !!t.context.websiteUrl, content: (t.context.contentLinks ?? []).length > 0 },
  });
  return {
    id: `sim-${t.persona}-${t.seed}`,
    lead: t.lead,
    insights: t.insights,
    context: t.context,
    turns: t.turns,
    expect: {
      readouts: t.readouts.map((r) => ({
        turn: r.turn,
        stance: r.stance,
        intent: r.intent,
        explicitOptOut: r.explicitOptOut,
        ...(r.answeredQuestionRef ? { answeredQuestionRef: r.answeredQuestionRef } : {}),
      })),
      flaggedTurns: [] as { index: number; rule: string }[],
      finalTrigger,
      finalLegal: legal,
      finalVetoed: [...new Set(vetoes.map((v) => v.move))],
      suppression: suppressionOf(lastLeadIsLast ? lastReadout : undefined),
    },
    notes: "sim",
  };
}

async function main() {
  if (!process.env.ANTHROPIC_API_KEY) throw new Error("ANTHROPIC_API_KEY is not set");
  const model = getModel();
  const judgeModel = getModel(JUDGE_MODEL_ID);
  const threads: SimThread[] = [];

  for (const persona of PERSONAS) {
    for (const seed of SEEDS) {
      const thread = await runSimThread(persona, {
        shortlist: shortlistMoves,
        compose: composeMessage,
        read: readTurn,
        rng: mulberry32(seed * 7919 + persona.id.length),
        model,
        judge: (convo) => judgeSimThread(convo, judgeModel),
        seed,
      });
      threads.push(thread);
      console.log(`${persona.id} seed ${seed}: ${thread.decisions.length} decisions, ${thread.readouts.length} replies, end ${thread.end}`);
    }
  }

  writeFileSync(resolve(pkg, "src/conversation/priors-sim.json"), `${JSON.stringify(simToPriors(threads), null, 2)}\n`);
  mkdirSync(fixturesDir, { recursive: true });
  for (const t of threads.slice(0, FIXTURE_LIMIT)) {
    writeFileSync(resolve(fixturesDir, `sim-${t.persona}-${t.seed}.json`), `${JSON.stringify(fixtureOf(t), null, 2)}\n`);
  }

  const mean = (xs: number[]) => (xs.length ? (xs.reduce((a, b) => a + b, 0) / xs.length).toFixed(2) : "-");
  console.log("\npersona          threads  replyRate  booked  optOuts  pressure  manip  repeat  idDetect");
  for (const persona of PERSONAS) {
    const ts = threads.filter((t) => t.persona === persona.id);
    const decisions = ts.flatMap((t) => t.decisions).filter((d) => d.move !== "wait");
    const replied = decisions.filter((d) => d.outcome.replied).length;
    const js = ts.map((t) => t.judge).filter((j): j is NonNullable<typeof j> => !!j);
    console.log(
      [
        persona.id.padEnd(16),
        String(ts.length).padStart(7),
        (decisions.length ? (replied / decisions.length).toFixed(2) : "-").padStart(10),
        String(ts.filter((t) => t.outcome.booked).length).padStart(7),
        String(ts.filter((t) => t.outcome.optOut).length).padStart(8),
        mean(js.map((j) => j.pressure)).padStart(9),
        mean(js.map((j) => j.manipulation)).padStart(6),
        mean(js.map((j) => j.repetition)).padStart(7),
        String(js.filter((j) => j.identityDetection).length).padStart(9),
      ].join(" "),
    );
  }
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});

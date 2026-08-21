import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import type { LanguageModel } from "ai";
import { draftLinkedIn, draftConversationMessage } from "@vantera/agent-brains";
import { getModel } from "@vantera/ai";
import { loadCopyLinkedinCorpus, loadCopyRespondCorpus, type CopyLinkedinCase, type CopyRespondCase } from "./corpus";
import { judgeCopy, JUDGE_MODEL_ID } from "./judge/judge";
import { cohensKappa, binOverall, KAPPA_TRUST_THRESHOLD, type CalibrationReport } from "./judge/kappa";
import { shouldSkipLiveEvals } from "./ci";

/**
 * The calibration LABELING PACKET builder + scorer (Phase 2C, Task 1 — "the unblocker"). This is
 * the piece that turns judge calibration (docs/evals.md's manual procedure, `judge/kappa.ts`'s
 * `runCalibration`) from "the owner hand-assembles ~100 drafts somehow" into a one-command build +
 * a one-command score, so the owner's labeling session (WS-2.3) is never blocked on tooling.
 *
 * Two halves, one file (matches the interface this task was scoped against):
 *
 * - `buildCalibrationPacket` — MACHINE side. Drafts real copy via the production brains across
 *   both copy corpora, scores each draft with the judge, and writes a `packet.json` with every
 *   `humanOverall` field hardcoded to `null`. The machine NEVER fills the human column — that is
 *   the entire integrity point of a calibration study (a judge can't calibrate against itself).
 *   `calibration-prep.test.ts` asserts this hard, on every entry, every run.
 * - `scoreCalibration` — HUMAN side. Reads back a packet the owner has hand-filled (replaced some
 *   `humanOverall: null`s with real 1-5 ints), pairs each labeled entry's already-computed
 *   `judgeOverall` against the human's `humanOverall`, and computes Cohen's kappa between them —
 *   the same binary good/bad binning (`binOverall`, `overall >= 4`) and the same 0.7 trust
 *   threshold (`KAPPA_TRUST_THRESHOLD`) as `runCalibration`. It does NOT call `judgeCopy` again —
 *   the packet already carries the judge's score for every entry, so re-judging would just spend
 *   money to recompute a number already on disk.
 *
 * ## Sampling approach
 *
 * The golden-set copy corpora (`fixtures/copy-linkedin/`, `fixtures/copy-respond/`) currently ship
 * 18 cases each — 36 total, short of the ~100-draft target a kappa study wants for a stable 2x2
 * confusion table. Rather than authoring dozens of one-off fixture files just to pad this study
 * (a bespoke calibration corpus nobody else benefits from), `buildCalibrationPacket` INTERLEAVES
 * both corpora (alternating linkedin/respond so neither brain dominates the packet) and CYCLES
 * back to the start once every case has been drafted once. Each pass through the corpus is a
 * "repeat" (0-indexed); a repeated case gets a `-v2`/`-v3`/... suffix on its `draftId` so every
 * entry in the packet is uniquely addressable even though multiple entries trace back to the same
 * fixture. This is deliberately NOT a bug dressed up as a feature: because the drafting model is
 * non-deterministic (real API calls, no fixed seed), re-drafting the same fixture input on a later
 * pass produces genuinely different draft text to label — the label pool gets real variety, not
 * 3x copies of the same 36 strings, at the cost of the corpus's ~36 distinct SITUATIONS never
 * growing past what already exists. At n=100 over the current 36-case corpus this is 2 full passes
 * (72 entries) plus a 28-entry third partial pass. If a future task grows either corpus, the same
 * function reaches the same ~100 target with proportionally fewer repeats, no code change needed.
 *
 * ## The linkedin `.text` choice
 *
 * `draftLinkedIn` returns TWO strings (`connectionNote`, `followupMessage`); the judge scores ONE
 * `text`. This packet uses `followupMessage` as the judge/label target, NOT the connection note or
 * a joined string, because: (1) the connection note is deliberately terse and pitch-free by design
 * (rule: no CTA, no links, under 200 chars — see `copy/linkedin.ts`) and almost never fails the
 * rubric's specificity/posture/naturalness dimensions in an interesting way, so it teaches the
 * judge/human pair less per label spent; (2) the follow-up message is the first real substantive
 * exchange — closer in shape and stakes to the `copy-respond` corpus's `.message` field, so judging
 * one consistent "one short outreach message" artifact type across both brains keeps the
 * calibration study measuring one thing, not conflating a connection-note rubric with a
 * conversation-message rubric; (3) it matches `ci.test.ts`'s existing precedent of treating
 * follow-up-shaped text as the representative artifact when only one string can be judged. A
 * joined `connectionNote + followupMessage` string was considered and rejected: it would score two
 * differently-purposed texts as one blob, muddying what a "3 vs 4" judge/human disagreement is
 * actually about.
 */

const __dirname = dirname(fileURLToPath(import.meta.url));
export const PACKET_PATH = join(__dirname, "..", "fixtures", "judge-calibration", "packet.json");

/** The labeling-packet row shape. `humanOverall` is typed as the LITERAL `null` (not `number |
 *  null`) on this producer side — the machine writes this file, and the machine has no way to
 *  produce anything but `null` here by construction. The human-filled packet `scoreCalibration`
 *  reads back is a wider shape (`humanOverall: number | null`) since that's the file AFTER a human
 *  has edited some rows; see `FilledCalibrationPacketEntry` below. */
export type CalibrationPacketEntry = {
  draftId: string;
  brain: "linkedin" | "respond";
  draftText: string;
  grounding: string;
  judgeOverall: number;
  humanOverall: null;
};

/** The shape `scoreCalibration` reads: a packet where the owner has replaced some (not
 *  necessarily all) `humanOverall: null`s with a real 1-5 int. Structurally a `CalibrationPacketEntry`
 *  with a widened `humanOverall`. */
type FilledCalibrationPacketEntry = Omit<CalibrationPacketEntry, "humanOverall"> & {
  humanOverall: number | null;
};

/** Below this many labeled entries, a kappa's 2x2 confusion-table margins are too thin to trust
 *  the trusted/not-trusted read (see the same reasoning in `binOverall`'s doc comment on why
 *  binary binning already exists — small-n instability is the same failure mode one level up).
 *  `scoreCalibration` refuses to compute a number that would look authoritative but isn't. */
export const MIN_LABELED_FOR_SCORE = 20;

type SampleUnit =
  | { brain: "linkedin"; case: CopyLinkedinCase; repeat: number }
  | { brain: "respond"; case: CopyRespondCase; repeat: number };

/** Interleaves both corpora and cycles back to the start until `n` units are produced. See the
 *  module doc's "Sampling approach" section for why cycling (not truncating or erroring) is the
 *  right behavior when `n` exceeds the combined corpus size. Returns fewer than `n` units only
 *  when BOTH corpora are empty (nothing to sample from at all). */
function sampleUnits(n: number, linkedinCases: CopyLinkedinCase[], respondCases: CopyRespondCase[]): SampleUnit[] {
  const combined: Array<{ brain: "linkedin"; case: CopyLinkedinCase } | { brain: "respond"; case: CopyRespondCase }> = [];
  const maxLen = Math.max(linkedinCases.length, respondCases.length);
  for (let i = 0; i < maxLen; i++) {
    const li = linkedinCases[i];
    if (li) combined.push({ brain: "linkedin", case: li });
    const re = respondCases[i];
    if (re) combined.push({ brain: "respond", case: re });
  }
  if (combined.length === 0) return [];

  const units: SampleUnit[] = [];
  for (let i = 0; i < n; i++) {
    const unit = combined[i % combined.length]!;
    const repeat = Math.floor(i / combined.length);
    units.push({ ...unit, repeat } as SampleUnit);
  }
  return units;
}

/**
 * Builds a fresh calibration labeling packet: samples ~`n` (case, brain) units across both copy
 * corpora (see module doc), drafts each via the real production brain, scores each draft with the
 * judge, and RETURNS the resulting entries. Deliberately PURE of file I/O — it never touches disk;
 * `main()` (the `evals:calibration-prep` entry point) owns writing the returned array to
 * `PACKET_PATH`. Keeping the write out of the builder means the mock-model tests can exercise the
 * full sampling/drafting/judging path without mutating any tracked file under `fixtures/`.
 *
 * `humanOverall` is HARDCODED to `null` on every entry, unconditionally — there is no code path in
 * this function that can set it to anything else. That is deliberate: the owner fills this column
 * by hand after downloading the packet, and a calibration study whose "human" column was ever
 * touched by the model being calibrated would be measuring nothing. `calibration-prep.test.ts`
 * asserts this on every entry, every run.
 */
export async function buildCalibrationPacket(
  n = 100,
  model: LanguageModel = getModel(),
  judgeModel: LanguageModel = getModel(JUDGE_MODEL_ID)
): Promise<CalibrationPacketEntry[]> {
  const linkedinCases = loadCopyLinkedinCorpus();
  const respondCases = loadCopyRespondCorpus();
  const units = sampleUnits(n, linkedinCases, respondCases);

  const entries: CalibrationPacketEntry[] = [];
  for (const unit of units) {
    const draftId = unit.repeat > 0 ? `${unit.case.id}-v${unit.repeat + 1}` : unit.case.id;

    const draftText =
      unit.brain === "linkedin"
        ? (await draftLinkedIn(unit.case.input, model)).followupMessage
        : (await draftConversationMessage(unit.case.input, model)).message;

    const verdict = await judgeCopy({ text: draftText }, { grounding: unit.case.grounding }, judgeModel);

    entries.push({
      draftId,
      brain: unit.brain,
      draftText,
      grounding: unit.case.grounding,
      judgeOverall: verdict.overall,
      humanOverall: null,
    });
  }

  return entries;
}

/**
 * Scores a human-filled calibration packet: reads `path`, keeps only entries where the owner has
 * replaced `humanOverall: null` with a real score, pairs each labeled entry's (already-computed,
 * NOT re-queried) `judgeOverall` against its `humanOverall`, bins both to binary good/bad
 * (`binOverall`, `overall >= 4`), and returns Cohen's kappa between the two binary series — the
 * exact same binning + threshold `runCalibration` (`judge/kappa.ts`) uses, so a packet-based score
 * and a `human-labels.json`-based score are directly comparable numbers.
 *
 * Deliberately does NOT call `judgeCopy` again: the packet already carries `judgeOverall` for every
 * entry (computed once, at build time), so re-judging here would spend real API cost to recompute
 * a number already on disk, and would risk sampling a different score if the judge model or prompt
 * moved between build and score time (the whole point of calibration is fixing the judge's ANSWER
 * at build time and only asking the human for their own independent read later).
 *
 * Throws when fewer than `MIN_LABELED_FOR_SCORE` entries are labeled — a kappa computed over a
 * near-empty confusion table would read as a confident number while actually being noise.
 */
export async function scoreCalibration(path: string): Promise<CalibrationReport> {
  const raw = JSON.parse(readFileSync(path, "utf8")) as FilledCalibrationPacketEntry[];
  const labeled = raw.filter((e) => e.humanOverall != null);

  if (labeled.length < MIN_LABELED_FOR_SCORE) {
    throw new Error(
      `scoreCalibration: only ${labeled.length} labeled entr${labeled.length === 1 ? "y" : "ies"} in ${path} — need at least ${MIN_LABELED_FOR_SCORE} to compute a trustworthy kappa. Label more entries (replace humanOverall: null with a 1-5 int) before scoring.`
    );
  }

  const judgeBins = labeled.map((e) => binOverall(e.judgeOverall));
  const humanBins = labeled.map((e) => binOverall(e.humanOverall as number));
  const kappa = cohensKappa(judgeBins, humanBins);

  return { kappa, trusted: kappa >= KAPPA_TRUST_THRESHOLD, n: labeled.length };
}

/**
 * The `evals:calibration-prep` entry point (`tsx src/calibration-prep.ts`). API-key-gated with the
 * SAME loud-skip contract as `evals:ci` (reuses `shouldSkipLiveEvals` from `./ci` rather than
 * duplicating the check) — an absent `ANTHROPIC_API_KEY` is always a visible `::warning`, never a
 * silent no-op, and never a call into `getModel()`'s own default-parameter throw.
 */
export async function main(): Promise<number> {
  if (shouldSkipLiveEvals(process.env)) {
    console.log(
      "::warning::ANTHROPIC_API_KEY not set — calibration packet build SKIPPED. Add the secret to run the owner labeling session (WS-2.3)."
    );
    return 0;
  }

  try {
    const entries = await buildCalibrationPacket();
    // main() owns the file write — buildCalibrationPacket stays pure (no disk I/O) so the
    // mock-model tests never mutate a tracked file under fixtures/.
    mkdirSync(dirname(PACKET_PATH), { recursive: true });
    writeFileSync(PACKET_PATH, `${JSON.stringify(entries, null, 2)}\n`, "utf8");
    console.log(`Wrote ${entries.length} entries to ${PACKET_PATH}`);
    console.log(
      "Next: download packet.json (the calibration-prep workflow artifact), fill each humanOverall (1-5), then run `pnpm --filter @vantera/evals evals:calibration-score <path>`."
    );
    return 0;
  } catch (err) {
    console.log(`::error::evals:calibration-prep failed: ${err instanceof Error ? err.message : String(err)}`);
    return 1;
  }
}

// Run only when executed directly (`tsx src/calibration-prep.ts`) — importing this module (as
// `calibration-prep.test.ts` and `calibration-score.ts` do) must never trigger a live run.
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().then((code) => process.exit(code));
}

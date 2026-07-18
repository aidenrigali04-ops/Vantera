import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterAll, describe, expect, it } from "vitest";
import { MockLanguageModelV3 } from "ai/test";
import {
  buildCalibrationPacket,
  scoreCalibration,
  MIN_LABELED_FOR_SCORE,
  PACKET_PATH,
  type CalibrationPacketEntry,
} from "./calibration-prep";

function textResponse(json: unknown) {
  return {
    finishReason: { unified: "stop" as const, raw: "stop" },
    usage: {
      inputTokens: { total: 1, noCache: 1, cacheRead: 0, cacheWrite: 0 },
      outputTokens: { total: 1, text: 1, reasoning: 0 },
    },
    content: [{ type: "text" as const, text: JSON.stringify(json) }],
    warnings: [],
  };
}

const CANNED_CONNECTION_NOTE = "Congrats on the recent team growth.";
const CANNED_FOLLOWUP = "Curious how the ramp is going with the new hires so far.";
const CANNED_CONVERSATION_MESSAGE = "Happy to share a couple of examples if that would help.";

/**
 * ONE draft model shared by both brains (`buildCalibrationPacket` takes a single `model` param for
 * drafting, same as the locked design), whose canned response depends on which brain's system
 * prompt is active for this call — detected by a unique substring from each brain's registered
 * system prompt (`LINKEDIN_SYSTEM` in `copy/linkedin.ts` vs `RESPOND_SYSTEM` in `reply/respond.ts`).
 * Both canned strings are clean by construction (no banned phrases, no dashes/semicolons, no
 * numeric claims, no links, no meeting-ask language) so `generateHumanized`'s humanizer lint passes
 * on the FIRST generation and never triggers its one bounded regenerate — exactly one `doGenerate`
 * call per brain call, so the entry count this test asserts stays exactly what `n` requests.
 */
function mockDraftModel(): MockLanguageModelV3 {
  return new MockLanguageModelV3({
    doGenerate: async (opts) => {
      const promptStr = JSON.stringify(opts.prompt);
      if (promptStr.includes("You write LinkedIn outreach for a B2B seller")) {
        return textResponse({ connection_note: CANNED_CONNECTION_NOTE, followup_message: CANNED_FOLLOWUP });
      }
      return textResponse({ message: CANNED_CONVERSATION_MESSAGE });
    },
  });
}

function mockJudgeModel(overall: number): MockLanguageModelV3 {
  return new MockLanguageModelV3({
    doGenerate: async () =>
      textResponse({
        specificity: overall,
        themFocus: overall,
        posture: overall,
        naturalness: overall,
        overall,
        rationale: "mocked verdict",
      }),
  });
}

describe("buildCalibrationPacket (mock models)", () => {
  it("writes exactly n entries, each with humanOverall hard-null, a 1-5 judgeOverall, and non-empty draftText matching the mocked brain output", async () => {
    const entries = await buildCalibrationPacket(6, mockDraftModel(), mockJudgeModel(4));

    expect(entries).toHaveLength(6);
    for (const entry of entries) {
      // THE integrity assertion: the machine must NEVER fill the human column. humanOverall must
      // be exactly null on every entry, every run — no code path in buildCalibrationPacket may set
      // it to anything else. This is the entire point of a calibration packet: a judge cannot be
      // calibrated against a label it produced itself.
      expect(entry.humanOverall).toBeNull();

      expect(Number.isInteger(entry.judgeOverall)).toBe(true);
      expect(entry.judgeOverall).toBeGreaterThanOrEqual(1);
      expect(entry.judgeOverall).toBeLessThanOrEqual(5);

      expect(typeof entry.draftText).toBe("string");
      expect(entry.draftText.length).toBeGreaterThan(0);
      expect([CANNED_FOLLOWUP, CANNED_CONVERSATION_MESSAGE]).toContain(entry.draftText);

      expect(["linkedin", "respond"]).toContain(entry.brain);
      expect(entry.draftId.length).toBeGreaterThan(0);
      expect(typeof entry.grounding).toBe("string");
    }

    // Persisted verbatim to the fixed packet path (fixtures/judge-calibration/packet.json).
    const written = JSON.parse(readFileSync(PACKET_PATH, "utf8")) as CalibrationPacketEntry[];
    expect(written).toEqual(entries);
  });

  it("never lets a non-null humanOverall through even across a larger, cycled sample", async () => {
    // n=40 exceeds the current 36-case combined corpus, so this exercises the cycle-back path
    // (see the module doc's "Sampling approach") while re-asserting the same integrity property.
    const entries = await buildCalibrationPacket(40, mockDraftModel(), mockJudgeModel(3));
    expect(entries).toHaveLength(40);
    expect(entries.every((e) => e.humanOverall === null)).toBe(true);

    const brains = new Set(entries.map((e) => e.brain));
    expect(brains.has("linkedin")).toBe(true);
    expect(brains.has("respond")).toBe(true);

    // Every draftId stays unique even though the corpus is smaller than n — repeats get a -vN
    // suffix rather than colliding.
    expect(new Set(entries.map((e) => e.draftId)).size).toBe(40);
    expect(entries.some((e) => /-v2$/.test(e.draftId))).toBe(true);
  });
});

type PacketRow = {
  draftId: string;
  brain: "linkedin" | "respond";
  draftText: string;
  grounding: string;
  judgeOverall: number;
  humanOverall: number | null;
};

describe("scoreCalibration (hand-filled packet fixtures)", () => {
  const tmpDir = mkdtempSync(join(tmpdir(), "calibration-score-test-"));

  afterAll(() => {
    rmSync(tmpDir, { recursive: true, force: true });
  });

  /**
   * Writes a packet realizing an exact 2x2 confusion matrix between binned judgeOverall and binned
   * humanOverall (a=TP: judge good/human good, b=FP: judge good/human bad, c=FN: judge bad/human
   * good, d=TN: judge bad/human bad). Uses the SAME hand-computed vectors as
   * `judge/kappa.test.ts`'s `buildConfusionFixture` (a=17,b=3,c=3,d=17 -> kappa=0.7 exactly;
   * a=17,b=4,c=3,d=16 -> kappa=0.65) so this test checks `scoreCalibration`'s packet-reading path
   * against numbers already independently verified against `cohensKappa` directly — `cohensKappa`
   * is symmetric in its two arguments (po/pe are both computed from label counts, order-independent),
   * so the same a/b/c/d config produces the same kappa regardless of which side is "judge" vs
   * "human".
   */
  function writeConfusionPacket(fileName: string, config: { a: number; b: number; c: number; d: number }): string {
    const rows: PacketRow[] = [];
    let idx = 0;
    const push = (judgeOverall: number, humanOverall: number, count: number) => {
      for (let i = 0; i < count; i++) {
        const draftId = `draft-${String(idx).padStart(3, "0")}`;
        rows.push({
          draftId,
          brain: idx % 2 === 0 ? "linkedin" : "respond",
          draftText: `${draftId} body text`,
          grounding: `${draftId} grounding`,
          judgeOverall,
          humanOverall,
        });
        idx++;
      }
    };
    push(5, 5, config.a); // TP
    push(5, 2, config.b); // FP
    push(2, 5, config.c); // FN
    push(2, 2, config.d); // TN

    const path = join(tmpDir, fileName);
    writeFileSync(path, JSON.stringify(rows, null, 2), "utf8");
    return path;
  }

  it("trusted stays TRUE exactly at the 0.7 threshold — hand-computed a=17,b=3,c=3,d=17,n=40 -> kappa=0.7", async () => {
    const path = writeConfusionPacket("packet-trusted.json", { a: 17, b: 3, c: 3, d: 17 });

    const report = await scoreCalibration(path);

    expect(report.n).toBe(40);
    expect(report.kappa).toBeCloseTo(0.7, 10);
    expect(report.trusted).toBe(true);
  });

  it("trusted is FALSE just below the 0.7 threshold — hand-computed a=17,b=4,c=3,d=16,n=40 -> kappa=0.65", async () => {
    const path = writeConfusionPacket("packet-untrusted.json", { a: 17, b: 4, c: 3, d: 16 });

    const report = await scoreCalibration(path);

    expect(report.n).toBe(40);
    expect(report.kappa).toBeCloseTo(0.65, 10);
    expect(report.trusted).toBe(false);
  });

  it("skips still-null entries and scores only the labeled subset", async () => {
    // 22 labeled (all perfect agreement -> kappa=1) + 3 still-null -> n must read 22, not 25.
    const rows: PacketRow[] = [];
    for (let i = 0; i < 22; i++) {
      rows.push({
        draftId: `labeled-${i}`,
        brain: "linkedin",
        draftText: `labeled-${i} body`,
        grounding: `labeled-${i} grounding`,
        judgeOverall: i % 2 === 0 ? 5 : 2,
        humanOverall: i % 2 === 0 ? 5 : 2,
      });
    }
    for (let i = 0; i < 3; i++) {
      rows.push({
        draftId: `unlabeled-${i}`,
        brain: "respond",
        draftText: `unlabeled-${i} body`,
        grounding: `unlabeled-${i} grounding`,
        judgeOverall: 4,
        humanOverall: null,
      });
    }
    const path = join(tmpDir, "packet-partial.json");
    writeFileSync(path, JSON.stringify(rows, null, 2), "utf8");

    const report = await scoreCalibration(path);

    expect(report.n).toBe(22);
    expect(report.kappa).toBeCloseTo(1, 10);
    expect(report.trusted).toBe(true);
  });

  it(`throws when fewer than ${MIN_LABELED_FOR_SCORE} entries are labeled`, async () => {
    const rows: PacketRow[] = [];
    for (let i = 0; i < 5; i++) {
      rows.push({
        draftId: `only-five-${i}`,
        brain: "linkedin",
        draftText: `only-five-${i} body`,
        grounding: `only-five-${i} grounding`,
        judgeOverall: 5,
        humanOverall: 5,
      });
    }
    const path = join(tmpDir, "packet-too-small.json");
    writeFileSync(path, JSON.stringify(rows, null, 2), "utf8");

    await expect(scoreCalibration(path)).rejects.toThrow(/only 5 labeled/i);
  });

  it("throws when NO entries are labeled yet (a freshly built, unfilled packet)", async () => {
    const rows: PacketRow[] = Array.from({ length: 10 }, (_, i) => ({
      draftId: `unfilled-${i}`,
      brain: "linkedin" as const,
      draftText: `unfilled-${i} body`,
      grounding: `unfilled-${i} grounding`,
      judgeOverall: 4,
      humanOverall: null,
    }));
    const path = join(tmpDir, "packet-unfilled.json");
    writeFileSync(path, JSON.stringify(rows, null, 2), "utf8");

    await expect(scoreCalibration(path)).rejects.toThrow();
  });
});

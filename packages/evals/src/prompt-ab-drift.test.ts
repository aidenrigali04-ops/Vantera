import { describe, expect, it } from "vitest";
import {
  avoidBlock as realAvoidBlock,
  exemplarBlock as realExemplarBlock,
  renderThread as realRenderThread,
  linkedinDraftSchema as realLinkedinDraftSchema,
  type ConversationTurn,
} from "@vantera/agent-brains";
import {
  avoidBlock as localAvoidBlock,
  exemplarBlock as localExemplarBlock,
  renderThread as localRenderThread,
  linkedinDraftEvalSchema as localLinkedinDraftSchema,
} from "./prompt-ab";

/**
 * Drift guardrail (Phase 2C fast-follow) for `prompt-ab.ts`'s local re-implementations of three
 * pure string-formatter helpers owned by `@vantera/agent-brains` (`copy/shared.ts`'s
 * `avoidBlock`/`exemplarBlock`, `reply/respond.ts`'s `renderThread`) plus its local mirror of
 * `copy/linkedin.ts`'s `linkedinDraftSchema`. See `prompt-ab.ts`'s module docstring for WHY the
 * rig keeps its own copies instead of importing them at runtime (it does, since the barrel now
 * re-exports all four specifically so this test can reach them read-only).
 *
 * Without this test, an edit to any of the four originals (in `copy/shared.ts`, `reply/respond.ts`,
 * or `copy/linkedin.ts`) would silently desync the local copies here, and the prompt A/B rig would
 * then measure candidate prompts against a DIFFERENT user-prompt assembly than production actually
 * uses — invalidating every subsequent A/B comparison without any error. This test makes that
 * failure loud instead of silent: it asserts the local copy and the real helper produce IDENTICAL
 * output on representative inputs (empty + populated, single + multiple, whitespace-only entries
 * that should be filtered).
 */

describe("prompt-ab drift guardrail — local prompt helpers vs the real @vantera/agent-brains formatters", () => {
  const avoidPhraseCases: (string[] | undefined)[] = [
    undefined,
    [],
    ["  "], // whitespace-only entry — must be trimmed away, leaving zero phrases
    ["let's connect"],
    ["let's connect", "  quick chat this week  ", "", "circling back to my last note"],
  ];

  it("avoidBlock: local copy matches the real helper on empty, single, and multi-phrase inputs", () => {
    for (const phrases of avoidPhraseCases) {
      expect(localAvoidBlock(phrases)).toBe(realAvoidBlock(phrases));
    }
  });

  const exemplarCases: (string[] | undefined)[] = [
    undefined,
    [],
    ["   "],
    ["loved how you scaled support without adding headcount"],
    ["opener one that landed", "  opener two, trimmed  ", "", "a third winning opener"],
  ];

  it("exemplarBlock: local copy matches the real helper on empty, single, and multi-exemplar inputs", () => {
    for (const exemplars of exemplarCases) {
      expect(localExemplarBlock(exemplars)).toBe(realExemplarBlock(exemplars));
    }
  });

  const threadCases: ConversationTurn[][] = [
    [],
    [{ role: "agent", text: "Hey, saw your post on churn." }],
    [
      { role: "agent", text: "Hey, saw your post on churn." },
      { role: "lead", text: "Yeah, it's been rough lately." },
      { role: "agent", text: "What's driving most of it?" },
    ],
  ];

  it("renderThread: local copy matches the real helper on an empty, single-turn, and multi-turn thread", () => {
    for (const thread of threadCases) {
      expect(localRenderThread(thread)).toBe(realRenderThread(thread));
    }
  });

  it("linkedin draft schema: the local eval schema accepts/rejects exactly what the real linkedinDraftSchema does", () => {
    const cases = [
      { connection_note: "short note", followup_message: "short follow-up" },
      { connection_note: "a".repeat(300), followup_message: "b".repeat(600) }, // exactly at cap
      { connection_note: "a".repeat(301), followup_message: "b" }, // connection_note over cap
      { connection_note: "a", followup_message: "b".repeat(601) }, // followup over cap
      { connection_note: "", followup_message: "" },
    ];
    for (const c of cases) {
      const real = realLinkedinDraftSchema.safeParse(c);
      const local = localLinkedinDraftSchema.safeParse(c);
      expect(local.success).toBe(real.success);
    }
  });

  it("proves the guardrail actually catches drift, not just confirms a coincidental match (a deliberately diverged copy fails)", () => {
    // A stand-in for what would happen if the real `avoidBlock` were edited (e.g. reworded the
    // "Vary your language" line) without updating prompt-ab.ts's local copy: the two outputs stop
    // matching. This proves the assertion technique above is discriminating, not vacuously true.
    const driftedAvoidBlock = (phrases?: string[]) => {
      const out = localAvoidBlock(phrases);
      return out === "" ? out : `${out}\n(drifted)`;
    };
    expect(driftedAvoidBlock(["let's connect"])).not.toBe(realAvoidBlock(["let's connect"]));

    const driftedRenderThread = (thread: ConversationTurn[]) =>
      thread.length === 0 ? "(no earlier messages yet)" : localRenderThread(thread).replace("You:", "Me:");
    expect(
      driftedRenderThread([{ role: "agent", text: "Hey there." }])
    ).not.toBe(realRenderThread([{ role: "agent", text: "Hey there." }]));
  });
});

import { describe, expect, it, vi } from "vitest";
import { bestOfN, type JudgeFn } from "./best-of-n";

type Draft = { text: string };

const CTX = { grounding: "prospect grounding facts", cta: "book a 15-min intro" };

describe("bestOfN — n<=1 short-circuits (feature OFF by default)", () => {
  it("n=1 calls draftFn exactly once, never calls the judge, and returns that single draft", async () => {
    const draftFn = vi.fn(async (): Promise<Draft> => ({ text: "only draft" }));
    const judge = vi.fn<JudgeFn>();

    const result = await bestOfN(1, draftFn, (d) => d.text, CTX, judge);

    expect(draftFn).toHaveBeenCalledTimes(1);
    expect(judge).not.toHaveBeenCalled();
    expect(result).toEqual({
      chosen: { text: "only draft" },
      candidates: [{ text: "only draft" }],
      scores: [],
    });
  });

  it("n=0 (defensive) also collapses to a single draft, zero judge calls", async () => {
    const draftFn = vi.fn(async (): Promise<Draft> => ({ text: "single" }));
    const judge = vi.fn<JudgeFn>();

    const result = await bestOfN(0, draftFn, (d) => d.text, CTX, judge);

    expect(draftFn).toHaveBeenCalledTimes(1);
    expect(judge).not.toHaveBeenCalled();
    expect(result.chosen).toEqual({ text: "single" });
    expect(result.scores).toEqual([]);
  });

  it("n=1 with no judge at all behaves identically (judge is entirely optional)", async () => {
    const draftFn = vi.fn(async (): Promise<Draft> => ({ text: "only draft" }));

    const result = await bestOfN(1, draftFn, (d) => d.text, CTX);

    expect(draftFn).toHaveBeenCalledTimes(1);
    expect(result).toEqual({
      chosen: { text: "only draft" },
      candidates: [{ text: "only draft" }],
      scores: [],
    });
  });
});

describe("bestOfN — n>1 judge-ranked selection", () => {
  it("drafts n candidates in parallel and picks the argmax-overall candidate (index 1 of [2,4,3])", async () => {
    let call = 0;
    const draftFn = vi.fn(async (): Promise<Draft> => {
      call += 1;
      return { text: `draft-${call}` };
    });
    const scoreByText: Record<string, number> = { "draft-1": 2, "draft-2": 4, "draft-3": 3 };
    const judge = vi.fn(async (draft: Draft) => ({ overall: scoreByText[draft.text]! }));

    const result = await bestOfN(3, draftFn, (d) => d.text, CTX, judge);

    expect(draftFn).toHaveBeenCalledTimes(3);
    expect(judge).toHaveBeenCalledTimes(3);
    expect(result.candidates).toEqual([{ text: "draft-1" }, { text: "draft-2" }, { text: "draft-3" }]);
    expect(result.scores).toEqual([2, 4, 3]);
    expect(result.chosen).toEqual({ text: "draft-2" });
  });

  it("ties resolve to the FIRST (earliest) index, never a later one", async () => {
    let call = 0;
    const draftFn = vi.fn(async (): Promise<Draft> => {
      call += 1;
      return { text: `draft-${call}` };
    });
    const scoreByText: Record<string, number> = { "draft-1": 4, "draft-2": 4, "draft-3": 2 };
    const judge = vi.fn(async (draft: Draft) => ({ overall: scoreByText[draft.text]! }));

    const result = await bestOfN(3, draftFn, (d) => d.text, CTX, judge);

    expect(result.scores).toEqual([4, 4, 2]);
    expect(result.chosen).toEqual({ text: "draft-1" });
  });

  it("preserves candidate order by invocation index even when later drafts resolve first", async () => {
    // draft-0 resolves LAST on purpose — candidates[] must still be index-ordered, not
    // completion-ordered, so scores[i] always lines up with candidates[i].
    const delays = [30, 0, 10];
    let call = 0;
    const draftFn = vi.fn(async (): Promise<Draft> => {
      const i = call;
      call += 1;
      await new Promise((r) => setTimeout(r, delays[i]));
      return { text: `draft-${i}` };
    });
    const judge = vi.fn(async (draft: Draft) => ({
      overall: draft.text === "draft-0" ? 5 : 1,
    }));

    const result = await bestOfN(3, draftFn, (d) => d.text, CTX, judge);

    expect(result.candidates.map((c) => c.text)).toEqual(["draft-0", "draft-1", "draft-2"]);
    expect(result.chosen).toEqual({ text: "draft-0" });
  });

  it("passes context (grounding + cta) through to the judge unchanged", async () => {
    const draftFn = vi.fn(async (): Promise<Draft> => ({ text: "d" }));
    const seenContexts: unknown[] = [];
    const judge = vi.fn(async (_draft: Draft, ctx: { grounding: string; cta?: string }) => {
      seenContexts.push(ctx);
      return { overall: 3 };
    });

    await bestOfN(2, draftFn, (d) => d.text, CTX, judge);

    expect(seenContexts).toEqual([CTX, CTX]);
  });

  it("n>1 with no judge falls back to the first candidate, and never calls the judge (defensive)", async () => {
    let call = 0;
    const draftFn = vi.fn(async (): Promise<Draft> => {
      call += 1;
      return { text: `draft-${call}` };
    });

    const result = await bestOfN(3, draftFn, (d) => d.text, CTX, undefined);

    expect(draftFn).toHaveBeenCalledTimes(3);
    expect(result.chosen).toEqual({ text: "draft-1" });
    expect(result.candidates).toHaveLength(3);
    expect(result.scores).toEqual([]);
  });
});

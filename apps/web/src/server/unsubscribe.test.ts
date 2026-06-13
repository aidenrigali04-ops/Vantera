import { describe, expect, it } from "vitest";
import { processUnsubscribe, type UnsubscribeDeps } from "./unsubscribe";

function makeDeps(overrides: Partial<UnsubscribeDeps> = {}) {
  const calls: string[] = [];
  const deps: UnsubscribeDeps = {
    findToken: async () => ({ accountId: "a1", leadId: "l1", email: "P@Acme.com", usedAt: null }),
    addSuppression: async (_a, email) => {
      calls.push(`suppress:${email}`);
    },
    markUsed: async () => {
      calls.push("used");
    },
    cancelPendingSends: async () => {
      calls.push("cancel");
    },
    ...overrides,
  };
  return { deps, calls };
}

describe("processUnsubscribe (rule 11: one click, no friction)", () => {
  it("suppresses lowercased email, marks used, cancels pending sends", async () => {
    const { deps, calls } = makeDeps();
    expect(await processUnsubscribe("tok1", deps)).toBe("ok");
    expect(calls).toEqual(["suppress:p@acme.com", "used", "cancel"]);
  });
  it("is idempotent: a used token still reports ok without re-writing", async () => {
    const { deps, calls } = makeDeps({
      findToken: async () => ({ accountId: "a1", leadId: "l1", email: "p@acme.com", usedAt: new Date() }),
    });
    expect(await processUnsubscribe("tok1", deps)).toBe("ok");
    expect(calls).toEqual([]);
  });
  it("unknown tokens report not_found", async () => {
    const { deps } = makeDeps({ findToken: async () => null });
    expect(await processUnsubscribe("nope", deps)).toBe("not_found");
  });
});

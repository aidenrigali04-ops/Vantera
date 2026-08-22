import { describe, expect, it, vi } from "vitest";
import { MockLanguageModelV3, simulateReadableStream } from "ai/test";
import { z } from "zod";
import { runCopilotTurn } from "./run";
import { searchKnowledgeTool } from "./knowledge";
import type { CopilotEvent, CopilotTool, KnowledgeRetriever, ToolContext } from "./types";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function collectEvents(events: CopilotEvent[]) {
  return (e: CopilotEvent) => events.push(e);
}

function makeCtx(retrieve: KnowledgeRetriever): ToolContext {
  return { accountId: "acct-test", retrieve };
}

/**
 * Build a two-step doStream sequence:
 *   step 1 → tool-call for `toolName` with `input`, finish with "tool-calls"
 *   step 2 → text-delta answer, finish with "stop"
 */
function twoStepStream(toolName: string, input: Record<string, unknown>, textAnswer: string) {
  const toolCallId = "tc-1";
  let call = 0;
  return async () => {
    call++;
    if (call === 1) {
      // First step: the model decides to call a tool
      return {
        stream: simulateReadableStream({
          initialDelayInMs: null,
          chunkDelayInMs: null,
          chunks: [
            { type: "stream-start" as const, warnings: [] },
            {
              type: "tool-call" as const,
              toolCallId,
              toolName,
              input: JSON.stringify(input),
            },
            {
              type: "finish" as const,
              finishReason: { unified: "tool-calls" as const, raw: "tool-calls" },
              usage: { inputTokens: { total: 10, noCache: 10, cacheRead: 0, cacheWrite: 0 }, outputTokens: { total: 5, text: 5, reasoning: 0 } },
            },
          ],
        }),
      };
    }
    // Second step: the model streams the answer
    return {
      stream: simulateReadableStream({
        initialDelayInMs: null,
        chunkDelayInMs: null,
        chunks: [
          { type: "stream-start" as const, warnings: [] },
          {
            type: "text-start" as const,
            id: "t1",
          },
          {
            type: "text-delta" as const,
            id: "t1",
            delta: textAnswer,
          },
          {
            type: "text-end" as const,
            id: "t1",
          },
          {
            type: "finish" as const,
            finishReason: { unified: "stop" as const, raw: "stop" },
            usage: { inputTokens: { total: 20, noCache: 20, cacheRead: 0, cacheWrite: 0 }, outputTokens: { total: 10, text: 10, reasoning: 0 } },
          },
        ],
      }),
    };
  };
}

/**
 * Build a doStream for a mutate tool scenario:
 *   step 1 → tool-call, finishes with "tool-calls"
 *   step 2+ → text response (the SDK will call again after the tool result)
 */
function mutateToolCallStream(toolName: string, input: Record<string, unknown>) {
  let call = 0;
  return async () => {
    call++;
    if (call === 1) {
      return {
        stream: simulateReadableStream({
          initialDelayInMs: null,
          chunkDelayInMs: null,
          chunks: [
            { type: "stream-start" as const, warnings: [] },
            {
              type: "tool-call" as const,
              toolCallId: "tc-mutate",
              toolName,
              input: JSON.stringify(input),
            },
            {
              type: "finish" as const,
              finishReason: { unified: "tool-calls" as const, raw: "tool-calls" },
              usage: { inputTokens: { total: 10, noCache: 10, cacheRead: 0, cacheWrite: 0 }, outputTokens: { total: 5, text: 5, reasoning: 0 } },
            },
          ],
        }),
      };
    }
    // Subsequent steps: just emit text (the tool returned awaiting_confirmation)
    return {
      stream: simulateReadableStream({
        initialDelayInMs: null,
        chunkDelayInMs: null,
        chunks: [
          { type: "stream-start" as const, warnings: [] },
          { type: "text-start" as const, id: "t1" },
          { type: "text-delta" as const, id: "t1", delta: "Please confirm the action." },
          { type: "text-end" as const, id: "t1" },
          {
            type: "finish" as const,
            finishReason: { unified: "stop" as const, raw: "stop" },
            usage: { inputTokens: { total: 10, noCache: 10, cacheRead: 0, cacheWrite: 0 }, outputTokens: { total: 5, text: 5, reasoning: 0 } },
          },
        ],
      }),
    };
  };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("runCopilotTurn", () => {
  it("auto-runs a read tool, emits tool_status and text events, and calls retrieve", async () => {
    const retrieve: KnowledgeRetriever = vi.fn(async () => [
      { slug: "send-modes", heading: null, content: "Automatic sends clean drafts.", similarity: 0.8 },
    ]);

    const model = new MockLanguageModelV3({
      doStream: twoStepStream("searchKnowledge", { query: "send modes" }, "Automatic sends clean drafts."),
    });

    const events: CopilotEvent[] = [];
    await runCopilotTurn({
      model,
      messages: [{ role: "user", content: "How do send modes work?" }],
      tools: [searchKnowledgeTool as unknown as CopilotTool],
      ctx: makeCtx(retrieve),
      onEvent: collectEvents(events),
    });

    // retrieve was called (the tool actually ran)
    expect(retrieve).toHaveBeenCalledOnce();

    // a tool_status event was emitted before the read ran
    const toolStatusEvents = events.filter((e) => e.type === "tool_status");
    expect(toolStatusEvents.length).toBeGreaterThan(0);
    expect((toolStatusEvents[0] as { type: "tool_status"; label: string }).label).toContain("help guide");

    // at least one text delta arrived
    const textEvents = events.filter((e) => e.type === "text");
    expect(textEvents.length).toBeGreaterThan(0);

    // model was called at least once for streaming
    expect(model.doStreamCalls.length).toBeGreaterThanOrEqual(1);
  });

  it("pauses on a mutate tool — emits confirmation event, does NOT call run", async () => {
    const mutateFn = vi.fn(async () => ({ summary: "Deleted!", undoable: false }));

    const fakeMutateTool: CopilotTool = {
      name: "deleteAllLeads",
      tier: "mutate",
      description: "Delete all leads in the account.",
      parameters: z.object({ confirm: z.boolean() }),
      confirmationSummary: () => "This will delete all your leads. Are you sure?",
      run: mutateFn,
    };

    const model = new MockLanguageModelV3({
      doStream: mutateToolCallStream("deleteAllLeads", { confirm: true }),
    });

    const events: CopilotEvent[] = [];
    await runCopilotTurn({
      model,
      messages: [{ role: "user", content: "Delete all my leads." }],
      tools: [fakeMutateTool],
      ctx: makeCtx(vi.fn(async () => [])),
      onEvent: collectEvents(events),
    });

    // run was NOT called
    expect(mutateFn).not.toHaveBeenCalled();

    // a confirmation event was emitted
    const confirmationEvents = events.filter((e) => e.type === "confirmation");
    expect(confirmationEvents.length).toBe(1);

    const conf = confirmationEvents[0] as Extract<CopilotEvent, { type: "confirmation" }>;
    expect(conf.tool).toBe("deleteAllLeads");
    expect(conf.summary).toBe("This will delete all your leads. Are you sure?");
    expect(conf.params).toEqual({ confirm: true });
    expect(typeof conf.actionId).toBe("string");
    expect(conf.actionId.length).toBeGreaterThan(0);
  });

  it("navigate tier: emits navigate event and does NOT call run", async () => {
    const runFn = vi.fn(async () => ({ ok: true }));

    const fakeNavigateTool: CopilotTool = {
      name: "openPage",
      tier: "navigate",
      description: "Navigate to a page in the app.",
      parameters: z.object({ route: z.string() }),
      run: runFn,
    };

    const model = new MockLanguageModelV3({
      doStream: mutateToolCallStream("openPage", { route: "/approvals" }),
    });

    const events: CopilotEvent[] = [];
    await runCopilotTurn({
      model,
      messages: [{ role: "user", content: "Take me to the approvals page." }],
      tools: [fakeNavigateTool],
      ctx: makeCtx(vi.fn(async () => [])),
      onEvent: collectEvents(events),
    });

    // run was NOT called
    expect(runFn).not.toHaveBeenCalled();

    // a navigate event was emitted
    const navigateEvents = events.filter((e) => e.type === "navigate");
    expect(navigateEvents.length).toBe(1);

    const nav = navigateEvents[0] as Extract<CopilotEvent, { type: "navigate" }>;
    expect(nav.action).toBe("openPage");
    expect(nav.params).toEqual({ route: "/approvals" });
  });

  it("approvedAction resume path: runs the tool and emits an outcome event", async () => {
    const runFn = vi.fn(async () => ({
      summary: "Lead archived.",
      undoable: true,
    }));

    const fakeMutateTool: CopilotTool = {
      name: "archiveLead",
      tier: "mutate",
      description: "Archive a lead.",
      parameters: z.object({ leadId: z.string() }),
      confirmationSummary: (args: Record<string, unknown>) => `Archive lead ${args["leadId"]}?`,
      run: runFn,
    };

    // The model only needs to stream a final text response (summarize after mutate ran)
    const model = new MockLanguageModelV3({
      doStream: async () => ({
        stream: simulateReadableStream({
          initialDelayInMs: null,
          chunkDelayInMs: null,
          chunks: [
            { type: "stream-start" as const, warnings: [] },
            { type: "text-start" as const, id: "t1" },
            { type: "text-delta" as const, id: "t1", delta: "Done! Lead archived." },
            { type: "text-end" as const, id: "t1" },
            {
              type: "finish" as const,
              finishReason: { unified: "stop" as const, raw: "stop" },
              usage: { inputTokens: { total: 5, noCache: 5, cacheRead: 0, cacheWrite: 0 }, outputTokens: { total: 5, text: 5, reasoning: 0 } },
            },
          ],
        }),
      }),
    });

    const events: CopilotEvent[] = [];
    await runCopilotTurn({
      model,
      messages: [{ role: "user", content: "Please archive lead 42." }],
      tools: [fakeMutateTool],
      ctx: makeCtx(vi.fn(async () => [])),
      onEvent: collectEvents(events),
      approvedAction: { tool: "archiveLead", params: { leadId: "42" } },
    });

    // run was called with the approved params
    expect(runFn).toHaveBeenCalledOnce();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    expect((runFn.mock.calls as any)[0][0]).toEqual({ leadId: "42" });

    // outcome event emitted
    const outcomeEvents = events.filter((e) => e.type === "outcome");
    expect(outcomeEvents.length).toBe(1);

    const outcome = outcomeEvents[0] as Extract<CopilotEvent, { type: "outcome" }>;
    expect(outcome.tool).toBe("archiveLead");
    expect(outcome.summary).toBe("Lead archived.");
    expect(outcome.undoable).toBe(true);

    // model also streamed a summary text
    const textEvents = events.filter((e) => e.type === "text");
    expect(textEvents.length).toBeGreaterThan(0);
  });
});

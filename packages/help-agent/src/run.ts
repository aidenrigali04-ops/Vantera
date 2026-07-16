import { streamText, tool as aiTool, stepCountIs } from "ai";
import type { LanguageModel, ModelMessage } from "ai";
import { SYSTEM_PROMPT } from "./prompt";
import { requiresConfirmation } from "./registry";
import type { CopilotEvent, CopilotTool, ToolContext } from "./types";

export interface RunArgs {
  model: LanguageModel;
  messages: ModelMessage[];
  tools: CopilotTool[];
  ctx: ToolContext;
  onEvent: (e: CopilotEvent) => void;
  /** when resuming after a confirmation, the approved action to run first */
  approvedAction?: { tool: string; params: Record<string, unknown> };
}

export async function runCopilotTurn(args: RunArgs): Promise<void> {
  const byName = new Map(args.tools.map((t) => [t.name, t]));

  // resume path: run the approved mutate, emit outcome, then let the model summarize
  if (args.approvedAction) {
    const t = byName.get(args.approvedAction.tool);
    if (t?.run && requiresConfirmation(t.tier)) {
      args.onEvent({ type: "tool_status", label: `Running ${t.name}…` });
      const result = (await t.run(args.approvedAction.params, args.ctx)) as {
        summary?: string;
        deepLink?: string;
        undoable?: boolean;
      };
      args.onEvent({
        type: "outcome",
        tool: t.name,
        summary: result.summary ?? "Done.",
        deepLink: result.deepLink,
        undoable: Boolean(result.undoable),
      });
    }
  }

  const aiTools = Object.fromEntries(
    args.tools.map((t) => [
      t.name,
      aiTool({
        description: t.description,
        inputSchema: t.parameters,
        execute: async (input: Record<string, unknown>) => {
          if (requiresConfirmation(t.tier)) {
            args.onEvent({
              type: "confirmation",
              actionId: crypto.randomUUID(),
              tool: t.name,
              summary: t.confirmationSummary?.(input) ?? `Run ${t.name}?`,
              params: input,
            });
            return { status: "awaiting_confirmation" };
          }
          if (t.tier === "navigate") {
            args.onEvent({
              type: "navigate",
              action: t.name as "openPage" | "highlightElement" | "startWalkthrough",
              params: input,
            });
            return { status: "navigated" };
          }
          args.onEvent({ type: "tool_status", label: labelFor(t.name) });
          return (await t.run?.(input, args.ctx)) ?? { ok: true };
        },
      }),
    ]),
  );

  const result = streamText({
    model: args.model,
    system: SYSTEM_PROMPT.text,
    messages: args.messages,
    tools: aiTools,
    stopWhen: stepCountIs(4),
  });

  for await (const delta of result.textStream) {
    args.onEvent({ type: "text", delta });
  }
}

function labelFor(name: string): string {
  const map: Record<string, string> = {
    searchKnowledge: "Checking the help guide…",
    getCampaignStatus: "Checking your agent…",
    getDraftQueueSummary: "Counting your drafts…",
    getGoalProgress: "Checking your progress…",
  };
  return map[name] ?? "Working…";
}

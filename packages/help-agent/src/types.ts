export type Tier = "read" | "navigate" | "mutate" | "critical";

/** A chunk returned by the injected retriever. */
export interface KnowledgeHit {
  slug: string;
  heading: string | null;
  content: string;
  similarity: number;
}
export type KnowledgeRetriever = (query: string, k?: number) => Promise<KnowledgeHit[]>;

/** Stream events the route emits to the overlay. */
export type CopilotEvent =
  | { type: "text"; delta: string }
  | { type: "tool_status"; label: string }
  | { type: "confirmation"; actionId: string; tool: string; summary: string; params: Record<string, unknown> }
  | { type: "outcome"; tool: string; summary: string; deepLink?: string; undoable: boolean }
  | { type: "navigate"; action: "openPage" | "highlightElement" | "startWalkthrough"; params: Record<string, unknown> }
  | { type: "meta"; conversationId: string; assistantMessageId: string }
  | { type: "error"; message: string };

/** A registered tool. `run` executes server-side with accountId injected; navigate tools
 *  carry no run (client effect) and surface their args via a navigate event. */
export interface ToolContext {
  accountId: string;
  retrieve: KnowledgeRetriever;
}

export interface CopilotTool<A = Record<string, unknown>, R = unknown> {
  name: string;
  tier: Tier;
  description: string;
  parameters: import("zod").ZodType<A>;
  /** plain-language consequence shown on the confirmation card (mutate/critical only) */
  confirmationSummary?: (args: A) => string;
  run?: (args: A, ctx: ToolContext) => Promise<R>;
}

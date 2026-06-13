import { z } from "zod";
import type { CopilotTool } from "./types";

const BANNED = /\b(smartlead|smartsenders|unipile|explorium|agentsource|voyage|anthropic|claude|supabase|trigger\.dev|higgsfield|clay)\b/gi;

/** Defense-in-depth: redact any vendor/internal name that leaked into a chunk before
 *  it reaches the model. Help content should never contain these (articles.test.ts guards),
 *  this is the second layer. */
export function sanitizeKnowledge<T extends { content: string }>(hits: T[]): T[] {
  return hits.map((h) => ({ ...h, content: h.content.replace(BANNED, "our platform") }));
}

export const searchKnowledgeTool: CopilotTool<{ query: string }, { chunks: { slug: string; heading: string | null; content: string }[] }> = {
  name: "searchKnowledge",
  tier: "read",
  description: "Search Vantera's help content for how a feature works. Use before answering any product question.",
  parameters: z.object({ query: z.string().min(1) }),
  run: async ({ query }, ctx) => {
    const hits = sanitizeKnowledge(await ctx.retrieve(query, 5));
    return { chunks: hits.map((h) => ({ slug: h.slug, heading: h.heading, content: h.content })) };
  },
};

import { z } from "zod";
import type { CopilotTool } from "./types";

export const searchKnowledgeTool: CopilotTool<{ query: string }, { chunks: { slug: string; heading: string | null; content: string }[] }> = {
  name: "searchKnowledge",
  tier: "read",
  description: "Search Vantera's help content for how a feature works. Use before answering any product question.",
  parameters: z.object({ query: z.string().min(1) }),
  run: async ({ query }, ctx) => {
    const hits = await ctx.retrieve(query, 5);
    return { chunks: hits.map((h) => ({ slug: h.slug, heading: h.heading, content: h.content })) };
  },
};

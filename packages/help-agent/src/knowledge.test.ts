import { describe, expect, it, vi } from "vitest";
import { searchKnowledgeTool } from "./knowledge";
import type { KnowledgeRetriever } from "./types";

const retriever: KnowledgeRetriever = vi.fn(async () => [
  { slug: "send-modes", heading: "Automatic", content: "Clean drafts send automatically.", similarity: 0.9 },
]);

describe("searchKnowledgeTool", () => {
  it("returns retrieved chunks as a citation-friendly DTO (no extra keys)", async () => {
    const result = await searchKnowledgeTool.run!({ query: "how does automatic sending work" }, { accountId: "a1", retrieve: retriever });
    expect(result).toEqual({ chunks: [{ slug: "send-modes", heading: "Automatic", content: "Clean drafts send automatically." }] });
    expect(retriever).toHaveBeenCalledWith("how does automatic sending work", 5);
  });
});

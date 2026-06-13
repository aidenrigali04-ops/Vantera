import { createEmbedderFromEnv } from "@vantera/ai";
import type { KnowledgeRetriever } from "@vantera/help-agent";
import type { SupabaseClient } from "@supabase/supabase-js";

/** db = service client (match_copilot_chunks is SECURITY DEFINER; chunks have no tenant policy). */
export function makeRetriever(db: SupabaseClient): KnowledgeRetriever {
  const embedder = createEmbedderFromEnv();
  return async (query: string, k = 5) => {
    const [embedding] = await embedder.embed([query], "query");
    const { data } = await db.rpc("match_copilot_chunks", {
      query_embedding: `[${embedding.join(",")}]`,
      match_count: k,
    });
    return (data ?? []).map(
      (r: {
        slug: string;
        heading: string | null;
        content: string;
        similarity: number;
      }) => ({
        slug: r.slug,
        heading: r.heading,
        content: r.content,
        similarity: r.similarity,
      })
    );
  };
}

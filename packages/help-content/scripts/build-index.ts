import { notInArray } from "drizzle-orm";
import { createDb, copilotKnowledgeChunks } from "@vantera/db";
import { createEmbedderFromEnv } from "@vantera/ai";
import { loadArticles, chunkArticle } from "../src/index";

// Idempotent: embed only chunks whose content_hash is new, then prune stale rows.
async function main() {
  const db = createDb();
  const embedder = createEmbedderFromEnv();
  const chunks = loadArticles().flatMap(chunkArticle);

  const existing = await db.select({ hash: copilotKnowledgeChunks.contentHash }).from(copilotKnowledgeChunks);
  const known = new Set(existing.map((r) => r.hash));
  const fresh = chunks.filter((c) => !known.has(c.contentHash));

  if (fresh.length > 0) {
    const vectors = await embedder.embed(fresh.map((c) => c.content), "document");
    await db.insert(copilotKnowledgeChunks).values(
      fresh.map((c, i) => ({ slug: c.slug, heading: c.heading, content: c.content, contentHash: c.contentHash, embedding: vectors[i]! }))
    );
  }

  // prune chunks no longer present in the content (empty content → wipe the table)
  const live = chunks.map((c) => c.contentHash);
  await db
    .delete(copilotKnowledgeChunks)
    .where(live.length > 0 ? notInArray(copilotKnowledgeChunks.contentHash, live) : undefined);

  console.log(`knowledge index: ${chunks.length} chunks, ${fresh.length} newly embedded`);
  process.exit(0);
}
main().catch((e) => { console.error(e); process.exit(1); });

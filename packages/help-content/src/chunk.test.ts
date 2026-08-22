import { describe, expect, it } from "vitest";
import { chunkArticle, type Chunk } from "./chunk";

const article = {
  slug: "review-queue",
  title: "Reviewing drafts",
  surface: "review",
  routes: ["/approvals"],
  body: "Intro paragraph about the queue.\n\n## After you approve\n\nApproved messages schedule.\n\nThey send at a human pace.",
};

describe("chunkArticle", () => {
  it("splits by heading, prefixing each chunk with title + heading for context", () => {
    const chunks = chunkArticle(article);
    expect(chunks.map((c) => c.heading)).toEqual([null, "After you approve"]);
    expect(chunks[0]?.content).toContain("Reviewing drafts");
    expect(chunks[0]?.content).toContain("Intro paragraph");
    expect(chunks[1]?.content).toContain("Approved messages schedule");
  });

  it("gives every chunk a stable content hash and the article slug", () => {
    const chunks = chunkArticle(article);
    expect(chunks.every((c) => c.slug === "review-queue")).toBe(true);
    expect(chunks[0]?.contentHash).toHaveLength(64); // sha-256 hex
    expect(chunkArticle(article)[0]?.contentHash).toBe(chunks[0]?.contentHash); // deterministic
  });
});

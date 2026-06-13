import { describe, expect, it, vi } from "vitest";
import { VoyageEmbedder, EMBED_DIM } from "./embeddings";

const fetchOk = (vectors: number[][]) =>
  vi.fn(async () => ({
    ok: true,
    json: async () => ({ data: vectors.map((embedding, index) => ({ embedding, index })) }),
  })) as unknown as typeof fetch;

describe("VoyageEmbedder", () => {
  it("embeds a batch and returns vectors in input order", async () => {
    const e = new VoyageEmbedder({ apiKey: "k", fetchFn: fetchOk([[0.1, 0.2], [0.3, 0.4]]) });
    expect(await e.embed(["a", "b"])).toEqual([[0.1, 0.2], [0.3, 0.4]]);
  });

  it("reorders out-of-order provider results back into input order", async () => {
    const outOfOrder = vi.fn(async () => ({
      ok: true,
      json: async () => ({
        data: [
          { embedding: [0.3, 0.4], index: 1 },
          { embedding: [0.1, 0.2], index: 0 },
        ],
      }),
    })) as unknown as typeof fetch;
    const e = new VoyageEmbedder({ apiKey: "k", fetchFn: outOfOrder });
    expect(await e.embed(["a", "b"])).toEqual([[0.1, 0.2], [0.3, 0.4]]);
  });

  it("throws when VOYAGE_API_KEY is missing", async () => {
    const prev = process.env.VOYAGE_API_KEY;
    delete process.env.VOYAGE_API_KEY;
    const { createEmbedderFromEnv } = await import("./embeddings");
    expect(() => createEmbedderFromEnv()).toThrow(/embeddings env var missing/);
    if (prev !== undefined) process.env.VOYAGE_API_KEY = prev;
  });

  it("throws a vendor-neutral error on a bad response", async () => {
    const e = new VoyageEmbedder({
      apiKey: "k",
      fetchFn: vi.fn(async () => ({ ok: false, status: 429 })) as unknown as typeof fetch,
    });
    await expect(e.embed(["a"])).rejects.toThrow(/embedding provider error 429/);
  });

  it("exposes the model's vector dimension", () => {
    expect(EMBED_DIM).toBe(1024);
  });
});

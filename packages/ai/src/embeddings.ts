export const VOYAGE_MODEL = "voyage-3";
export const EMBED_DIM = 1024; // must match vector(1024) in 0011

export interface EmbedderConfig {
  apiKey: string;
  fetchFn?: typeof fetch;
  model?: string;
}

/** The single embeddings entry (rule 02). Vendor name never leaves this file. */
export class VoyageEmbedder {
  private readonly fetchFn: typeof fetch;
  private readonly model: string;
  constructor(private readonly cfg: EmbedderConfig) {
    this.fetchFn = cfg.fetchFn ?? fetch;
    this.model = cfg.model ?? VOYAGE_MODEL;
  }

  async embed(texts: string[], inputType: "query" | "document" = "document"): Promise<number[][]> {
    const res = await this.fetchFn("https://api.voyageai.com/v1/embeddings", {
      method: "POST",
      headers: { "content-type": "application/json", authorization: `Bearer ${this.cfg.apiKey}` },
      body: JSON.stringify({ model: this.model, input: texts, input_type: inputType }),
    });
    if (!res.ok) throw new Error(`embedding provider error ${res.status}`);
    const json = (await res.json()) as { data: { embedding: number[]; index: number }[] };
    return json.data.sort((a, b) => a.index - b.index).map((d) => d.embedding);
  }
}

/** The only construction point product code may use. */
export function createEmbedderFromEnv(): VoyageEmbedder {
  const apiKey = process.env.VOYAGE_API_KEY;
  if (!apiKey) throw new Error("embeddings env var missing");
  return new VoyageEmbedder({ apiKey });
}

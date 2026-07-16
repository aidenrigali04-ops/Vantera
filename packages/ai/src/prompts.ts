/**
 * Prompt registry (enterprise-grade-brain spec, WS-2.1): every system prompt is registered with
 * a stable content hash so generations become attributable to an exact prompt revision. The text
 * stays a stable string constant — Anthropic prompt caching depends on that; the hash is
 * metadata, never injected into the prompt. Phase 2 stamps `hash` into SendRecipe v2.
 * Pure TS (FNV-1a 64-bit) — no node:crypto, safe in every runtime.
 */
export type RegisteredPrompt = { name: string; text: string; hash: string };

const registry = new Map<string, RegisteredPrompt>();

// BigInt() calls (not `123n` literals) so this compiles under any downstream tsconfig target —
// a consuming package (apps/web) targets ES2017, and bigint LITERAL syntax needs ES2020+ even
// though the BigInt runtime/lib itself is available (TS2737). Values are identical either way.
export function fnv1a64(input: string): string {
  let hash = BigInt("0xcbf29ce484222325");
  const prime = BigInt("0x100000001b3");
  const mask = BigInt("0xffffffffffffffff");
  for (let i = 0; i < input.length; i++) {
    hash ^= BigInt(input.charCodeAt(i));
    hash = (hash * prime) & mask;
  }
  return hash.toString(16).padStart(16, "0");
}

export function registerPrompt(name: string, text: string): RegisteredPrompt {
  const existing = registry.get(name);
  if (existing) {
    if (existing.text === text) return existing;
    throw new Error(`prompt "${name}" already registered with different text`);
  }
  const entry = { name, text, hash: fnv1a64(text) };
  registry.set(name, entry);
  return entry;
}

export function listPrompts(): RegisteredPrompt[] {
  return [...registry.values()];
}

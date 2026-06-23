/**
 * Remove unpaired UTF-16 surrogate code units from text. Scraped content (e.g. a LinkedIn post with
 * a mangled emoji) can carry a lone surrogate; when the AI SDK serializes the prompt to JSON for the
 * Anthropic API it becomes invalid JSON ("no low surrogate in string") and the request 400s, failing
 * the whole run. This strips only the UNPAIRED halves — valid surrogate pairs (real emoji) are kept.
 * Apply to any prompt built from external/scraped text before it reaches a model.
 */
export function stripLoneSurrogates(s: string): string {
  return s
    .replace(/[\uD800-\uDBFF](?![\uDC00-\uDFFF])/g, "")
    .replace(/(?<![\uD800-\uDBFF])[\uDC00-\uDFFF]/g, "");
}

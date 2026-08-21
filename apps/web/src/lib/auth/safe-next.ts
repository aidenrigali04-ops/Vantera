/**
 * R3: validate a post-login redirect target. Only same-origin relative paths pass —
 * anything absolute, protocol-relative, or escaped is dropped so `?next=` can never
 * become an open redirect.
 */
export function safeNext(raw: unknown): string | null {
  const v = typeof raw === "string" ? raw.trim() : "";
  if (!v.startsWith("/")) return null;
  if (v.startsWith("//") || v.includes("://") || v.includes("\\")) return null;
  return v;
}
